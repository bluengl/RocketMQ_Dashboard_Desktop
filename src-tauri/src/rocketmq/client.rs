use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::sync::atomic::{AtomicI32, Ordering};

use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use sha1::Sha1;

use super::protocol::{
    RemotingCommand, ClusterInfoResponse, TopicListResponse, TopicRouteData, MessageExt,
    SubscriptionGroupListResponse, ConsumerConnection, ConnectionInfo, ProducerConnection,
    ProducerTableInfo,
    TraceNode, ConsumerStatus, TraceRecord,
    GET_BROKER_CLUSTER_INFO, GET_ALL_TOPIC_LIST_FROM_NAMESERVER, GET_ROUTEINFO_BY_TOPIC,
    QUERY_MESSAGE, PULL_MESSAGE, VIEW_MESSAGE_BY_ID, SEARCH_OFFSET_BY_TIMESTAMP, UPDATE_AND_CREATE_TOPIC,
    DELETE_TOPIC_IN_NAMESRV, DELETE_TOPIC_IN_BROKER, SUCCESS,
    GET_ALL_SUBSCRIPTIONGROUP_CONFIG, GET_CONSUMER_CONNECTION_LIST, QUERY_CONSUMER_OFFSET,
    UPDATE_CONSUMER_OFFSET, GET_MAX_OFFSET, GET_MIN_OFFSET,
    GET_PRODUCER_CONNECTION_LIST, GET_ALL_PRODUCER_INFO,
    SEND_MESSAGE, SEND_MESSAGE_V2, REQUEST_CODE_NOT_SUPPORTED,
    TopicQueueStatus, TopicStatus, TopicUpdateResult, SendMessageResult,
    DEFAULT_TRACE_TOPIC, TRACE_CONTENT_SPLITOR, TRACE_FIELD_SPLITOR,
    TOPIC_NOT_EXIST, QUERY_NOT_FOUND, NO_MESSAGE,
    GET_BROKER_RUNTIME_INFO, VIEW_BROKER_STATS_DATA, GET_BROKER_CONSUME_STATS,
    AUTH_CREATE_USER, AUTH_UPDATE_USER, AUTH_DELETE_USER, AUTH_LIST_USER,
    AUTH_CREATE_ACL, AUTH_UPDATE_ACL, AUTH_DELETE_ACL, AUTH_LIST_ACL,
    UserInfo, AclInfo,
};

static OPAQUE_COUNTER: AtomicI32 = AtomicI32::new(1);

const TRACE_QUERY_MAX: i32 = 64;
const ONE_HOUR_MILLIS: i64 = 3_600_000;
const ONE_DAY_MILLIS: i64 = 86_400_000;

fn next_opaque() -> i32 {
    OPAQUE_COUNTER.fetch_add(1, Ordering::SeqCst)
}

/// Sign a request the way RocketMQ's AclClientRPCHook does:
/// HMAC-SHA1 over the sorted ext-field values plus the body, base64 encoded.
fn sign_command(
    command: &RemotingCommand,
    body: &[u8],
    credentials: &Option<(String, String)>,
) -> Result<RemotingCommand, String> {
    let Some((access_key, secret_key)) = credentials else {
        return Ok(command.clone());
    };

    let mut fields = command.ext_fields.clone().unwrap_or_default();
    fields.insert("AccessKey".to_string(), access_key.clone());

    let sorted: BTreeMap<String, String> = fields.clone().into_iter().collect();
    let mut content = String::new();
    for value in sorted.values() {
        content.push_str(value);
    }

    let mut data = content.into_bytes();
    data.extend_from_slice(body);

    let mut mac = Hmac::<Sha1>::new_from_slice(secret_key.as_bytes())
        .map_err(|e| format!("Init ACL signature failed: {}", e))?;
    mac.update(&data);
    let signature = general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    fields.insert("Signature".to_string(), signature);
    let mut signed = command.clone();
    signed.ext_fields = Some(fields);
    Ok(signed)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub name_server_addrs: Vec<String>,
    pub acl_enabled: bool,
    pub access_key: Option<String>,
    pub secret_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerInfo {
    pub broker_name: String,
    pub cluster_name: String,
    pub broker_addrs: Vec<String>,
    pub version: String,
    pub online: bool,
    pub master_addr: Option<String>,
    pub slave_addrs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClusterInfo {
    pub brokers: Vec<BrokerInfo>,
    pub total_topics: u32,
    pub total_groups: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrokerMetrics {
    pub broker_name: String,
    pub cluster: String,
    pub broker_addr: String,
    pub online: bool,
    pub version: String,
    pub uptime: String,
    pub put_tps: f64,
    pub get_tps: f64,
    pub msg_put_today: i64,
    pub msg_get_today: i64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardMetrics {
    pub brokers: Vec<BrokerMetrics>,
    pub total_topics: u32,
    pub total_groups: u32,
    pub total_put_tps: f64,
    pub total_get_tps: f64,
    pub sampled_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsumerProgress {
    pub topic: String,
    pub broker_name: String,
    pub queue_id: i32,
    pub broker_offset: i64,
    pub consumer_offset: i64,
    pub lag: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerAclUsers {
    pub broker_addr: String,
    pub users: Vec<UserInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerAclRules {
    pub broker_addr: String,
    pub rules: Vec<AclInfo>,
    pub error: Option<String>,
}

pub struct RocketMQClient {
    name_server_addrs: Vec<String>,
    current_addr_index: usize,
    credentials: Option<(String, String)>,
    group_count_cache: std::sync::Mutex<Option<(std::time::Instant, u32)>>,
}

impl RocketMQClient {
    pub fn new(config: ConnectionConfig) -> Result<Self, String> {
        if config.name_server_addrs.is_empty() {
            return Err("NameServer address list cannot be empty".to_string());
        }

        let credentials = match (config.access_key, config.secret_key) {
            (Some(access_key), Some(secret_key))
                if !access_key.is_empty() && !secret_key.is_empty() =>
            {
                Some((access_key, secret_key))
            }
            _ => None,
        };

        Ok(Self {
            name_server_addrs: config.name_server_addrs,
            current_addr_index: 0,
            credentials,
            group_count_cache: std::sync::Mutex::new(None),
        })
    }

    fn get_current_addr(&self) -> &str {
        &self.name_server_addrs[self.current_addr_index]
    }

    fn send_command_to(&self, addr: &str, command: &RemotingCommand) -> Result<(RemotingCommand, Vec<u8>), String> {
        self.send_raw_to(addr, command, &[])
    }

    fn send_raw_to(&self, addr: &str, command: &RemotingCommand, body: &[u8]) -> Result<(RemotingCommand, Vec<u8>), String> {
        let signed = sign_command(command, body, &self.credentials)?;
        let mut stream = TcpStream::connect_timeout(
            &addr.parse().map_err(|e| format!("Parse address failed: {}", e))?,
            Duration::from_secs(5),
        )
        .map_err(|e| format!("Connect to {} failed: {}", addr, e))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| format!("Set read timeout failed: {}", e))?;
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| format!("Set write timeout failed: {}", e))?;

        let request_data = signed.encode_with_body(body)?;
        stream
            .write_all(&request_data)
            .map_err(|e| format!("Send request failed: {}", e))?;
        stream
            .flush()
            .map_err(|e| format!("Flush stream failed: {}", e))?;

        let mut len_buf = [0u8; 4];
        stream
            .read_exact(&mut len_buf)
            .map_err(|e| format!("Read response length failed: {}", e))?;
        let total_len = i32::from_be_bytes(len_buf) as usize;

        if total_len > 10 * 1024 * 1024 {
            return Err("Response too large".to_string());
        }

        let mut response_data = vec![0u8; total_len];
        stream
            .read_exact(&mut response_data)
            .map_err(|e| format!("Read response data failed: {}", e))?;

        RemotingCommand::decode(&response_data)
    }

    fn send_command(&self, command: &RemotingCommand) -> Result<(RemotingCommand, Vec<u8>), String> {
        self.send_command_to(self.get_current_addr(), command)
    }

    pub fn test_connection(&self) -> Result<(), String> {
        let command = RemotingCommand::new_request(GET_BROKER_CLUSTER_INFO, next_opaque());
        let (response, _) = self.send_command(&command)?;

        if response.code == SUCCESS {
            Ok(())
        } else {
            Err(format!("Server returned error code: {}", response.code))
        }
    }

    pub fn get_cluster_info(&self) -> Result<ClusterInfo, String> {
        let command = RemotingCommand::new_request(GET_BROKER_CLUSTER_INFO, next_opaque());
        let (response, body) = self.send_command(&command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Get cluster info failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        if body.is_empty() {
            return Err("Empty response body".to_string());
        }

        let cluster_response: ClusterInfoResponse = parse_json_normalized(&body)
            .map_err(|e| format!("Parse cluster info failed: {}", e))?;

        let topic_count = self.get_topic_list().map(|topics| topics.len() as u32).unwrap_or(0);

        let mut brokers = Vec::new();
        for (_, broker_data) in cluster_response.broker_addr_table.iter() {
            let master_addr = broker_data.broker_addrs.get(&0).cloned();
            let mut slave_addrs: Vec<String> = broker_data
                .broker_addrs
                .iter()
                .filter(|(id, _)| **id != 0)
                .map(|(_, addr)| addr.clone())
                .collect();
            slave_addrs.sort();

            let mut addrs: Vec<String> = Vec::new();
            if let Some(master) = &master_addr {
                addrs.push(master.clone());
            }
            addrs.extend(slave_addrs.iter().cloned());

            brokers.push(BrokerInfo {
                broker_name: broker_data.broker_name.clone(),
                cluster_name: broker_data.cluster.clone(),
                broker_addrs: addrs,
                version: "Unknown".to_string(),
                online: true,
                master_addr,
                slave_addrs,
            });
        }

        Ok(ClusterInfo {
            brokers,
            total_topics: topic_count,
            total_groups: 0, // TODO: implement consumer group query
        })
    }

    pub fn get_topic_list(&self) -> Result<Vec<String>, String> {
        let command = RemotingCommand::new_request(GET_ALL_TOPIC_LIST_FROM_NAMESERVER, next_opaque());
        let (response, body) = self.send_command(&command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Get topic list failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        if body.is_empty() {
            return Ok(Vec::new());
        }

        let topic_response: TopicListResponse = serde_json::from_slice(&body)
            .map_err(|e| format!("Parse topic list failed: {}", e))?;

        Ok(topic_response.topic_list)
    }

    pub fn get_route_info_by_topic(&self, topic: &str) -> Result<TopicRouteData, String> {
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        let command = RemotingCommand::new_request(GET_ROUTEINFO_BY_TOPIC, next_opaque())
            .with_ext_fields(ext);
        let (response, body) = self.send_command(&command)?;

        if response.code != SUCCESS {
            return Err(describe_failure("Get route info failed", response.code, &response.remark));
        }

        if body.is_empty() {
            return Err("Empty route info response".to_string());
        }

        let route: TopicRouteData = parse_json_normalized(&body)
            .map_err(|e| format!("Parse route info failed: {}", e))?;

        Ok(route)
    }

    /// A missing topic is a normal "no results" case for message searches.
    fn route_if_topic_exists(&self, topic: &str) -> Result<Option<TopicRouteData>, String> {
        match self.get_route_info_by_topic(topic) {
            Ok(route) => Ok(Some(route)),
            Err(error) if error.contains(&format!("code={}", TOPIC_NOT_EXIST)) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn query_message_by_key(&self, topic: &str, key: &str) -> Result<Vec<MessageExt>, String> {
        let Some(route) = self.route_if_topic_exists(topic)? else {
            return Ok(Vec::new());
        };
        let broker_addr = route
            .broker_datas
            .first()
            .and_then(|broker| broker.broker_addrs.get(&0))
            .cloned()
            .ok_or_else(|| format!("No broker found for topic: {}", topic))?;
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("key".to_string(), key.to_string());
        ext.insert("maxNum".to_string(), "32".to_string());
        ext.insert("beginTimestamp".to_string(), "0".to_string());
        ext.insert("endTimestamp".to_string(), "9999999999999".to_string());
        let command = RemotingCommand::new_request(QUERY_MESSAGE, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(&broker_addr, &command)?;

        if response.code == QUERY_NOT_FOUND {
            return Ok(Vec::new());
        }
        if response.code != SUCCESS {
            return Err(format!(
                "Query message by key failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        parse_messages(&body)
    }

    pub fn query_message_by_id(&self, msg_id: &str) -> Result<Vec<MessageExt>, String> {
        // VIEW_MESSAGE_BY_ID looks a message up by its physical commitlog offset,
        // which is encoded in the last 8 bytes of the message ID.
        let (broker_addr, offset) = decode_msg_id(msg_id)?;
        let mut ext = HashMap::new();
        ext.insert("offset".to_string(), offset.to_string());
        let command = RemotingCommand::new_request(VIEW_MESSAGE_BY_ID, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(&broker_addr, &command)?;

        if response.code == QUERY_NOT_FOUND {
            // A lookup miss is an empty result, not a failure.
            return Ok(Vec::new());
        }
        if response.code != SUCCESS {
            return Err(format!(
                "Query message by id failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        parse_messages(&body)
    }

    fn search_offset(&self, addr: &str, topic: &str, queue_id: i32, timestamp: i64) -> Result<i64, String> {
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("queueId".to_string(), queue_id.to_string());
        ext.insert("timestamp".to_string(), timestamp.to_string());
        let command = RemotingCommand::new_request(SEARCH_OFFSET_BY_TIMESTAMP, next_opaque()).with_ext_fields(ext);
        let (response, _) = self.send_command_to(addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Search offset failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        response
            .ext_fields
            .as_ref()
            .and_then(|f| f.get("offset"))
            .and_then(|s| s.parse::<i64>().ok())
            .ok_or_else(|| "No offset in search response".to_string())
    }

    fn pull_from(
        &self,
        addr: &str,
        topic: &str,
        queue_id: i32,
        queue_offset: i64,
        max_num: i32,
    ) -> Result<(Vec<MessageExt>, i64), String> {
        let mut ext = HashMap::new();
        ext.insert("consumerGroup".to_string(), "rocketmq-dashboard-desktop".to_string());
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("queueId".to_string(), queue_id.to_string());
        ext.insert("queueOffset".to_string(), queue_offset.to_string());
        ext.insert("maxMsgNums".to_string(), max_num.to_string());
        // PullSysFlag: subscription flag (0x4)
        ext.insert("sysFlag".to_string(), "4".to_string());
        ext.insert("commitOffset".to_string(), "0".to_string());
        ext.insert("suspendTimeoutMillis".to_string(), "0".to_string());
        ext.insert("subscription".to_string(), "*".to_string());
        ext.insert("subVersion".to_string(), "0".to_string());
        ext.insert("expressionType".to_string(), "TAG".to_string());

        let command = RemotingCommand::new_request(PULL_MESSAGE, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Pull message failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        let next_offset = response
            .ext_fields
            .as_ref()
            .and_then(|fields| fields.get("nextBeginOffset"))
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(queue_offset);

        Ok((parse_messages(&body)?, next_offset))
    }

    /// QUERY_MESSAGE only supports key lookups, so a time-range scan uses
    /// PULL_MESSAGE per queue, mirroring the official dashboard implementation.
    pub fn query_message_by_time(&self, topic: &str, begin_ts: i64, end_ts: i64) -> Result<Vec<MessageExt>, String> {
        let Some(route) = self.route_if_topic_exists(topic)? else {
            return Ok(Vec::new());
        };
        let mut all = Vec::new();

        for broker in &route.broker_datas {
            let Some(addr) = broker.broker_addrs.get(&0).cloned() else {
                continue;
            };
            let Some(queue_data) = route
                .queue_datas
                .iter()
                .find(|queue| queue.broker_name == broker.broker_name)
            else {
                continue;
            };

            for queue_id in 0..queue_data.read_queue_nums {
                let begin_offset = self.search_offset(&addr, topic, queue_id, begin_ts).unwrap_or(0);
                let end_offset = match self.search_offset(&addr, topic, queue_id, end_ts) {
                    Ok(value) => value,
                    Err(_) => continue,
                };
                if end_offset < begin_offset {
                    continue;
                }

                let mut offset = begin_offset;
                let mut pulls = 0;
                while offset <= end_offset && pulls < 64 && all.len() < 2000 {
                    pulls += 1;
                    let (batch, next_offset) = match self.pull_from(&addr, topic, queue_id, offset, 32) {
                        Ok(value) => value,
                        Err(_) => break,
                    };
                    if batch.is_empty() {
                        break;
                    }
                    for message in batch {
                        if let Some(timestamp) = message.store_timestamp {
                            if timestamp >= begin_ts && timestamp <= end_ts {
                                all.push(message);
                            }
                        }
                    }
                    if next_offset <= offset {
                        break;
                    }
                    offset = next_offset;
                }
            }
        }

        all.sort_by_key(|message| std::cmp::Reverse(message.store_timestamp.unwrap_or(0)));
        Ok(all)
    }

    /// Trace lookup by message id: queries the trace topic by key (the broker stores the
    /// original msgId as the trace message's key), then parses the trace contexts.
    pub fn query_message_trace(
        &self,
        msg_id: &str,
        trace_topic: Option<&str>,
    ) -> Result<TraceRecord, String> {
        let trace_topic = trace_topic
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_TRACE_TOPIC);
        let now = now_millis();
        let (begin, end) = match self.resolve_store_timestamp(msg_id) {
            // Derive the window from the original message so traces older than the fallback
            // window are still found (trace data is retained 72h by default).
            Some(store_ts) => (
                store_ts - 5 * 60_000,
                (store_ts + ONE_DAY_MILLIS).max(now + 60_000),
            ),
            None => (now - ONE_HOUR_MILLIS, now + 60_000),
        };
        self.query_trace_messages(trace_topic, msg_id, begin, end, Some(msg_id))
    }

    /// Trace lookup by business key. The trace query itself is scoped by key, so no
    /// per-context msgId filtering is applied.
    pub fn query_message_trace_by_key(
        &self,
        key: &str,
        trace_topic: Option<&str>,
    ) -> Result<TraceRecord, String> {
        let trace_topic = trace_topic
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_TRACE_TOPIC);
        let now = now_millis();
        self.query_trace_messages(
            trace_topic,
            key,
            now - ONE_DAY_MILLIS,
            now + 60_000,
            None,
        )
    }

    fn query_trace_messages(
        &self,
        trace_topic: &str,
        query_key: &str,
        begin: i64,
        end: i64,
        filter_msg_id: Option<&str>,
    ) -> Result<TraceRecord, String> {
        // No route means the cluster never dispatched to the trace topic: no trace data.
        let broker_addrs: Vec<String> = match self.get_route_info_by_topic(trace_topic) {
            Ok(route) => route
                .broker_datas
                .iter()
                .filter_map(|b| b.broker_addrs.get(&0).cloned())
                .collect(),
            Err(_) => Vec::new(),
        };
        if broker_addrs.is_empty() {
            return Ok(TraceRecord::default());
        }

        // The trace topic may live on several brokers; aggregate their results like
        // DefaultMQAdminExt.queryMessage does.
        let mut record = TraceRecord::default();
        let mut succeeded = false;
        let mut last_error = None;

        for broker_addr in broker_addrs {
            let mut ext = HashMap::new();
            ext.insert("topic".to_string(), trace_topic.to_string());
            ext.insert("key".to_string(), query_key.to_string());
            ext.insert("maxNum".to_string(), TRACE_QUERY_MAX.to_string());
            ext.insert("beginTimestamp".to_string(), begin.to_string());
            ext.insert("endTimestamp".to_string(), end.to_string());
            let command =
                RemotingCommand::new_request(QUERY_MESSAGE, next_opaque()).with_ext_fields(ext);
            let (response, body) = match self.send_command_to(&broker_addr, &command) {
                Ok(result) => result,
                Err(e) => {
                    last_error = Some(format!("{}: {}", broker_addr, e));
                    continue;
                }
            };

            if response.code != SUCCESS {
                if matches!(
                    response.code,
                    TOPIC_NOT_EXIST | QUERY_NOT_FOUND | NO_MESSAGE
                ) {
                    // This broker holds no trace data for the query.
                    succeeded = true;
                    continue;
                }
                last_error = Some(format!(
                    "{}: code={}, remark={:?}",
                    broker_addr, response.code, response.remark
                ));
                continue;
            }

            match parse_messages(&body) {
                Ok(messages) => {
                    for message in messages {
                        if let Some(encoded_body) = message.body.as_deref() {
                            parse_trace_body(encoded_body, filter_msg_id, &mut record);
                        }
                    }
                    succeeded = true;
                }
                Err(e) => last_error = Some(format!("{}: {}", broker_addr, e)),
            }
        }

        if !succeeded {
            return Err(last_error
                .unwrap_or_else(|| "No broker available for trace topic".to_string()));
        }

        Ok(record)
    }

    fn resolve_store_timestamp(&self, msg_id: &str) -> Option<i64> {
        self.query_message_by_id(msg_id)
            .ok()?
            .first()
            .and_then(|m| m.store_timestamp)
    }

    pub fn create_topic(
        &self,
        topic: &str,
        broker_addr: &str,
        read_queue_nums: i32,
        write_queue_nums: i32,
        perm: i32,
    ) -> Result<(), String> {
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("defaultTopic".to_string(), "TBW102".to_string());
        ext.insert("readQueueNums".to_string(), read_queue_nums.to_string());
        ext.insert("writeQueueNums".to_string(), write_queue_nums.to_string());
        ext.insert("perm".to_string(), perm.to_string());
        ext.insert("topicFilterType".to_string(), "SINGLE_TAG".to_string());
        ext.insert("order".to_string(), "false".to_string());
        let command = RemotingCommand::new_request(UPDATE_AND_CREATE_TOPIC, next_opaque()).with_ext_fields(ext);
        let (response, _) = self.send_command_to(broker_addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Create topic failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        Ok(())
    }

    pub fn delete_topic(&self, topic: &str) -> Result<(), String> {
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());

        let brokers: Vec<String> = self
            .get_route_info_by_topic(topic)
            .map(|route| {
                route
                    .broker_datas
                    .iter()
                    .filter_map(|b| b.broker_addrs.get(&0).cloned())
                    .collect()
            })
            .unwrap_or_default();

        for addr in &brokers {
            let cmd = RemotingCommand::new_request(DELETE_TOPIC_IN_BROKER, next_opaque()).with_ext_fields(ext.clone());
            let _ = self.send_command_to(addr, &cmd);
        }

        let namesrv_cmd = RemotingCommand::new_request(DELETE_TOPIC_IN_NAMESRV, next_opaque()).with_ext_fields(ext);
        let (response, _) = self.send_command(&namesrv_cmd)?;
        if response.code != SUCCESS {
            return Err(format!(
                "Delete topic from nameserver failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        Ok(())
    }

    pub fn update_topic(
        &self,
        topic: &str,
        read_queue_nums: i32,
        write_queue_nums: i32,
        perm: i32,
        broker_addr: Option<&str>,
    ) -> Result<TopicUpdateResult, String> {
        if read_queue_nums <= 0 || write_queue_nums <= 0 {
            return Err("Queue counts must be greater than zero".to_string());
        }
        if perm < 0 || perm > 7 {
            return Err("Permission must be between 0 and 7".to_string());
        }

        let route = self.get_route_info_by_topic(topic)?;
        let mut targets: Vec<(String, String)> = Vec::new();

        match broker_addr {
            Some(addr) => {
                let name = route
                    .broker_datas
                    .iter()
                    .find(|b| b.broker_addrs.get(&0).map(|a| a == addr).unwrap_or(false))
                    .map(|b| b.broker_name.clone())
                    .unwrap_or_else(|| addr.to_string());
                targets.push((name, addr.to_string()));
            }
            None => {
                for broker in &route.broker_datas {
                    if let Some(addr) = broker.broker_addrs.get(&0) {
                        targets.push((broker.broker_name.clone(), addr.clone()));
                    }
                }
            }
        }

        if targets.is_empty() {
            return Err(format!("No master broker found for topic: {}", topic));
        }

        let mut updated_brokers = Vec::new();
        let mut errors = Vec::new();
        for (name, addr) in targets {
            let mut ext = HashMap::new();
            ext.insert("topic".to_string(), topic.to_string());
            ext.insert("defaultTopic".to_string(), "TBW102".to_string());
            ext.insert("readQueueNums".to_string(), read_queue_nums.to_string());
            ext.insert("writeQueueNums".to_string(), write_queue_nums.to_string());
            ext.insert("perm".to_string(), perm.to_string());
            ext.insert("topicFilterType".to_string(), "SINGLE_TAG".to_string());
            ext.insert("order".to_string(), "false".to_string());

            let command = RemotingCommand::new_request(UPDATE_AND_CREATE_TOPIC, next_opaque())
                .with_ext_fields(ext);
            match self.send_command_to(&addr, &command) {
                Ok((response, _)) if response.code == SUCCESS => updated_brokers.push(name),
                Ok((response, _)) => errors.push(format!(
                    "{}: code={}, remark={:?}",
                    addr, response.code, response.remark
                )),
                Err(error) => errors.push(format!("{}: {}", addr, error)),
            }
        }

        if updated_brokers.is_empty() {
            return Err(format!("Update topic failed: {}", errors.join("; ")));
        }

        Ok(TopicUpdateResult {
            updated_brokers,
            errors,
        })
    }

    pub fn get_topic_status(&self, topic: &str) -> Result<TopicStatus, String> {
        let route = self.get_route_info_by_topic(topic)?;
        let mut queues = Vec::new();
        let mut errors = Vec::new();
        let mut total_messages = 0i64;

        for queue_data in &route.queue_datas {
            let addr = match route
                .broker_datas
                .iter()
                .find(|b| b.broker_name == queue_data.broker_name)
                .and_then(|b| b.broker_addrs.get(&0).cloned())
            {
                Some(addr) => addr,
                None => {
                    errors.push(format!(
                        "{}: no master broker address",
                        queue_data.broker_name
                    ));
                    continue;
                }
            };

            for queue_id in 0..queue_data.read_queue_nums {
                let min_offset = match self.min_offset(&addr, topic, queue_id) {
                    Ok(v) => v,
                    Err(error) => {
                        errors.push(format!("{} queue {} min: {}", addr, queue_id, error));
                        continue;
                    }
                };
                let max_offset = match self.max_offset(&addr, topic, queue_id) {
                    Ok(v) => v,
                    Err(error) => {
                        errors.push(format!("{} queue {} max: {}", addr, queue_id, error));
                        continue;
                    }
                };
                let message_count = (max_offset - min_offset).max(0);
                total_messages += message_count;

                queues.push(TopicQueueStatus {
                    broker_name: queue_data.broker_name.clone(),
                    broker_addr: addr.clone(),
                    queue_id,
                    min_offset,
                    max_offset,
                    message_count,
                });
            }
        }

        if queues.is_empty() && !errors.is_empty() {
            return Err(format!("Get topic status failed: {}", errors.join("; ")));
        }

        Ok(TopicStatus {
            topic: topic.to_string(),
            queues,
            total_messages,
            errors,
        })
    }

    pub fn send_message(
        &self,
        topic: &str,
        body: &str,
        tag: Option<&str>,
        key: Option<&str>,
        queue_id: Option<i32>,
        broker_name: Option<&str>,
    ) -> Result<SendMessageResult, String> {
        if body.len() > 4 * 1024 * 1024 {
            return Err("Message body must not exceed 4 MB".to_string());
        }

        let route = self.get_route_info_by_topic(topic)?;
        let broker = match broker_name {
            Some(name) => route
                .broker_datas
                .iter()
                .find(|b| b.broker_name == name)
                .ok_or_else(|| format!("Broker '{}' does not carry topic '{}'", name, topic))?,
            None => route
                .broker_datas
                .first()
                .ok_or_else(|| format!("No broker found for topic: {}", topic))?,
        };

        let addr = broker
            .broker_addrs
            .get(&0)
            .cloned()
            .ok_or_else(|| format!("No master broker for topic: {}", topic))?;
        let broker_name = broker.broker_name.clone();

        let write_queue_nums = route
            .queue_datas
            .iter()
            .find(|q| q.broker_name == broker_name)
            .map(|q| q.write_queue_nums)
            .unwrap_or(1)
            .max(1);

        let queue_id = match queue_id {
            Some(q) if q >= 0 && q < write_queue_nums => q,
            Some(q) => {
                return Err(format!(
                    "Queue ID {} is out of range (0..{})",
                    q,
                    write_queue_nums - 1
                ))
            }
            None => (now_millis().rem_euclid(write_queue_nums as i64)) as i32,
        };

        let mut properties = String::from("WAIT\u{0001}true");
        if let Some(tag) = tag.filter(|t| !t.is_empty()) {
            validate_property_value("tag", tag)?;
            properties.push_str(&format!("\u{0002}TAGS\u{0001}{}", tag));
        }
        if let Some(key) = key.filter(|k| !k.is_empty()) {
            validate_property_value("key", key)?;
            properties.push_str(&format!("\u{0002}KEYS\u{0001}{}", key));
        }

        let born_timestamp = now_millis();
        let producer_group = "rocketmq-dashboard-desktop";

        // RocketMQ SendMessageRequestHeaderV2 short field mapping:
        // a producerGroup, b topic, c defaultTopic, d defaultTopicQueueNums,
        // e queueId, f sysFlag, g bornTimestamp, h flag, i properties,
        // j reconsumeTimes, k unitMode, l maxReconsumeTimes, m batch, n waitStoreMsgOK.
        let mut ext = HashMap::new();
        ext.insert("a".to_string(), producer_group.to_string());
        ext.insert("b".to_string(), topic.to_string());
        ext.insert("c".to_string(), "TBW102".to_string());
        ext.insert("d".to_string(), "4".to_string());
        ext.insert("e".to_string(), queue_id.to_string());
        ext.insert("f".to_string(), "0".to_string());
        ext.insert("g".to_string(), born_timestamp.to_string());
        ext.insert("h".to_string(), "0".to_string());
        ext.insert("i".to_string(), properties.clone());
        ext.insert("j".to_string(), "0".to_string());
        ext.insert("k".to_string(), "false".to_string());
        ext.insert("l".to_string(), "0".to_string());
        ext.insert("m".to_string(), "false".to_string());
        ext.insert("n".to_string(), "true".to_string());

        let command = RemotingCommand::new_request(SEND_MESSAGE_V2, next_opaque())
            .with_ext_fields(ext);
        let (mut response, _) = self.send_raw_to(&addr, &command, body.as_bytes())?;

        if response.code == REQUEST_CODE_NOT_SUPPORTED {
            // Brokers older than 4.6 only understand SEND_MESSAGE with long field names.
            let mut legacy = HashMap::new();
            legacy.insert("producerGroup".to_string(), producer_group.to_string());
            legacy.insert("topic".to_string(), topic.to_string());
            legacy.insert("defaultTopic".to_string(), "TBW102".to_string());
            legacy.insert("defaultTopicQueueNums".to_string(), "4".to_string());
            legacy.insert("queueId".to_string(), queue_id.to_string());
            legacy.insert("sysFlag".to_string(), "0".to_string());
            legacy.insert("bornTimestamp".to_string(), born_timestamp.to_string());
            legacy.insert("flag".to_string(), "0".to_string());
            legacy.insert("properties".to_string(), properties);
            legacy.insert("reconsumeTimes".to_string(), "0".to_string());
            legacy.insert("unitMode".to_string(), "false".to_string());
            legacy.insert("maxReconsumeTimes".to_string(), "0".to_string());
            legacy.insert("batch".to_string(), "false".to_string());
            legacy.insert("waitStoreMsgOK".to_string(), "true".to_string());
            let command = RemotingCommand::new_request(SEND_MESSAGE, next_opaque())
                .with_ext_fields(legacy);
            response = self.send_raw_to(&addr, &command, body.as_bytes())?.0;
        }

        if response.code != SUCCESS {
            return Err(format!(
                "Send message failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        let fields = response.ext_fields.unwrap_or_default();
        Ok(SendMessageResult {
            msg_id: fields.get("msgId").cloned().unwrap_or_default(),
            queue_id: fields
                .get("queueId")
                .and_then(|v| v.parse().ok())
                .unwrap_or(queue_id),
            queue_offset: fields
                .get("queueOffset")
                .and_then(|v| v.parse().ok())
                .unwrap_or(-1),
            broker_name,
            broker_addr: addr,
        })
    }

    fn broker_master_addrs(&self) -> Result<Vec<String>, String> {
        let command = RemotingCommand::new_request(GET_BROKER_CLUSTER_INFO, next_opaque());
        let (response, body) = self.send_command(&command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Get broker list failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        let info: ClusterInfoResponse = parse_json_normalized(&body)
            .map_err(|e| format!("Parse broker list failed: {}", e))?;

        Ok(info
            .broker_addr_table
            .values()
            .filter_map(|b| b.broker_addrs.get(&0).cloned())
            .collect())
    }

    pub fn get_consumer_groups(&self) -> Result<Vec<String>, String> {
        let addrs = self.broker_master_addrs()?;
        let mut groups = BTreeSet::new();
        let mut succeeded = false;
        let mut last_error = None;

        for addr in &addrs {
            let command = RemotingCommand::new_request(GET_ALL_SUBSCRIPTIONGROUP_CONFIG, next_opaque());
            match self.send_command_to(addr, &command) {
                Ok((response, body)) if response.code == SUCCESS => {
                    match parse_json_normalized::<SubscriptionGroupListResponse>(&body) {
                        Ok(parsed) => {
                            groups.extend(parsed.subscription_group_table.into_keys());
                            succeeded = true;
                        }
                        Err(e) => last_error = Some(format!("{}: {}", addr, e)),
                    }
                }
                Ok((response, _)) => {
                    last_error = Some(format!(
                        "{}: code={}, remark={:?}",
                        addr, response.code, response.remark
                    ));
                }
                Err(e) => last_error = Some(format!("{}: {}", addr, e)),
            }
        }

        if !succeeded {
            return Err(last_error.unwrap_or_else(|| "No broker available".to_string()));
        }

        Ok(groups.into_iter().collect())
    }

    pub fn get_consumer_connections(
        &self,
        group: &str,
    ) -> Result<Option<ConsumerConnection>, String> {
        let addrs = self.broker_master_addrs()?;
        let mut aggregate = ConsumerConnection::default();
        let mut online = false;
        let mut responded = false;
        let mut last_error = None;

        for addr in &addrs {
            let mut ext = HashMap::new();
            ext.insert("consumerGroup".to_string(), group.to_string());
            let command = RemotingCommand::new_request(GET_CONSUMER_CONNECTION_LIST, next_opaque())
                .with_ext_fields(ext);

            match self.send_command_to(addr, &command) {
                Ok((response, _)) if response.code != SUCCESS => {
                    // 206 means the group is not online on this broker
                    responded = true;
                }
                Ok((_, body)) if body.is_empty() => {
                    responded = true;
                    online = true;
                }
                Ok((_, body)) => {
                    responded = true;
                    let parsed: ConsumerConnection = serde_json::from_slice(&body)
                        .map_err(|e| format!("Parse consumer connection failed: {}", e))?;
                    online = true;
                    aggregate.connection_set.extend(parsed.connection_set);
                    aggregate.subscription_table.extend(parsed.subscription_table);
                    if aggregate.consume_type.is_none() {
                        aggregate.consume_type = parsed.consume_type;
                    }
                    if aggregate.message_model.is_none() {
                        aggregate.message_model = parsed.message_model;
                    }
                    if aggregate.consume_from_where.is_none() {
                        aggregate.consume_from_where = parsed.consume_from_where;
                    }
                }
                Err(e) => last_error = Some(format!("{}: {}", addr, e)),
            }
        }

        if !responded {
            return Err(last_error.unwrap_or_else(|| "No broker available".to_string()));
        }

        Ok(if online { Some(aggregate) } else { None })
    }

    fn read_offset(
        &self,
        addr: &str,
        request_code: i32,
        ext: HashMap<String, String>,
    ) -> Result<i64, String> {
        let command = RemotingCommand::new_request(request_code, next_opaque()).with_ext_fields(ext);
        let (response, _) = self.send_command_to(addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Read offset failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        response
            .ext_fields
            .as_ref()
            .and_then(|f| f.get("offset"))
            .and_then(|s| s.parse::<i64>().ok())
            .ok_or_else(|| "No offset in response".to_string())
    }

    fn max_offset(&self, addr: &str, topic: &str, queue_id: i32) -> Result<i64, String> {
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("queueId".to_string(), queue_id.to_string());
        self.read_offset(addr, GET_MAX_OFFSET, ext)
    }

    fn min_offset(&self, addr: &str, topic: &str, queue_id: i32) -> Result<i64, String> {
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("queueId".to_string(), queue_id.to_string());
        self.read_offset(addr, GET_MIN_OFFSET, ext)
    }

    fn consumer_offset(
        &self,
        addr: &str,
        group: &str,
        topic: &str,
        queue_id: i32,
    ) -> Result<i64, String> {
        let mut ext = HashMap::new();
        ext.insert("consumerGroup".to_string(), group.to_string());
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("queueId".to_string(), queue_id.to_string());
        self.read_offset(addr, QUERY_CONSUMER_OFFSET, ext)
    }

    pub fn get_consumer_progress(
        &self,
        group: &str,
        topic: Option<&str>,
    ) -> Result<Vec<ConsumerProgress>, String> {
        let topics: Vec<String> = match topic {
            Some(t) => vec![t.to_string()],
            None => {
                let connection = self.get_consumer_connections(group)?.ok_or_else(|| {
                    format!(
                        "Consumer group '{}' is not online; please select a topic",
                        group
                    )
                })?;
                let mut topics: Vec<String> = connection.subscription_table.into_keys().collect();
                topics.sort();
                if topics.is_empty() {
                    return Err(format!(
                        "Consumer group '{}' has no subscriptions; please select a topic",
                        group
                    ));
                }
                topics
            }
        };

        let mut rows = Vec::new();
        for topic in topics {
            let route = self.get_route_info_by_topic(&topic)?;

            for queue_data in &route.queue_datas {
                let addr = match route
                    .broker_datas
                    .iter()
                    .find(|b| b.broker_name == queue_data.broker_name)
                    .and_then(|b| b.broker_addrs.get(&0).cloned())
                {
                    Some(a) => a,
                    None => continue,
                };

                for queue_id in 0..queue_data.read_queue_nums {
                    let broker_offset = match self.max_offset(&addr, &topic, queue_id) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    let consumer_offset =
                        self.consumer_offset(&addr, group, &topic, queue_id).unwrap_or(0);

                    rows.push(ConsumerProgress {
                        topic: topic.clone(),
                        broker_name: queue_data.broker_name.clone(),
                        queue_id,
                        broker_offset,
                        consumer_offset,
                        lag: (broker_offset - consumer_offset).max(0),
                    });
                }
            }
        }

        Ok(rows)
    }

    pub fn reset_consumer_offset(
        &self,
        group: &str,
        topic: &str,
        queue_id: Option<i32>,
        offset_type: &str,
        offset: Option<i64>,
    ) -> Result<usize, String> {
        let route = self.get_route_info_by_topic(topic)?;
        let mut applied = 0usize;

        for queue_data in &route.queue_datas {
            let addr = match route
                .broker_datas
                .iter()
                .find(|b| b.broker_name == queue_data.broker_name)
                .and_then(|b| b.broker_addrs.get(&0).cloned())
            {
                Some(a) => a,
                None => continue,
            };

            let queue_ids: Vec<i32> = match queue_id {
                Some(q) => vec![q],
                None => (0..queue_data.read_queue_nums).collect(),
            };

            for qid in queue_ids {
                let target = match offset_type {
                    "max" => self.max_offset(&addr, topic, qid)?,
                    "min" => self.min_offset(&addr, topic, qid)?,
                    "offset" => offset.ok_or("A custom offset value is required")?,
                    other => return Err(format!("Unknown offset type: {}", other)),
                };

                let mut ext = HashMap::new();
                ext.insert("consumerGroup".to_string(), group.to_string());
                ext.insert("topic".to_string(), topic.to_string());
                ext.insert("queueId".to_string(), qid.to_string());
                ext.insert("commitOffset".to_string(), target.to_string());

                let command =
                    RemotingCommand::new_request(UPDATE_CONSUMER_OFFSET, next_opaque())
                        .with_ext_fields(ext);
                let (response, _) = self.send_command_to(&addr, &command)?;

                if response.code != SUCCESS {
                    return Err(format!(
                        "Reset offset failed: code={}, remark={:?}",
                        response.code, response.remark
                    ));
                }

                applied += 1;
            }
        }

        Ok(applied)
    }

    fn broker_master_entries(&self) -> Result<Vec<(String, String, String)>, String> {
        let command = RemotingCommand::new_request(GET_BROKER_CLUSTER_INFO, next_opaque());
        let (response, body) = self.send_command(&command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Get broker list failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        let info: ClusterInfoResponse = parse_json_normalized(&body)
            .map_err(|e| format!("Parse broker list failed: {}", e))?;

        Ok(info
            .broker_addr_table
            .values()
            .filter_map(|broker| {
                broker.broker_addrs.get(&0).map(|addr| {
                    (
                        broker.broker_name.clone(),
                        broker.cluster.clone(),
                        addr.clone(),
                    )
                })
            })
            .collect())
    }

    pub fn get_broker_runtime_info(
        &self,
        broker_addr: &str,
    ) -> Result<HashMap<String, String>, String> {
        let command = RemotingCommand::new_request(GET_BROKER_RUNTIME_INFO, next_opaque());
        let (response, body) = self.send_command_to(broker_addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Get broker runtime info failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        if body.is_empty() {
            return Err("Empty broker runtime info response".to_string());
        }

        let parsed: serde_json::Value = serde_json::from_slice(&body)
            .map_err(|e| format!("Parse broker runtime info failed: {}", e))?;
        let table = parsed
            .get("table")
            .or_else(|| parsed.get("runtimeInfo"))
            .unwrap_or(&parsed);
        let object = table
            .as_object()
            .ok_or_else(|| "Unexpected broker runtime info shape".to_string())?;

        Ok(object
            .iter()
            .map(|(key, value)| {
                let text = value
                    .as_str()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| value.to_string());
                (key.clone(), text)
            })
            .collect())
    }

    fn cached_group_count(&self) -> Result<u32, String> {
        if let Ok(cache) = self.group_count_cache.lock() {
            if let Some((sampled_at, count)) = *cache {
                if sampled_at.elapsed() < Duration::from_secs(30) {
                    return Ok(count);
                }
            }
        }

        let count = self.get_consumer_groups()?.len() as u32;
        if let Ok(mut cache) = self.group_count_cache.lock() {
            *cache = Some((std::time::Instant::now(), count));
        }
        Ok(count)
    }

    pub fn get_dashboard_metrics(&self) -> Result<DashboardMetrics, String> {
        let entries = self.broker_master_entries()?;
        let total_topics = self
            .get_topic_list()
            .map(|topics| topics.len() as u32)
            .unwrap_or(0);
        let total_groups = self.cached_group_count().unwrap_or(0);

        let mut brokers = Vec::new();
        let mut total_put_tps = 0.0;
        let mut total_get_tps = 0.0;

        for (broker_name, cluster, broker_addr) in entries {
            match self.get_broker_runtime_info(&broker_addr) {
                Ok(table) => {
                    let put_tps = parse_first_f64(table.get("putTps"));
                    let get_tps = parse_first_f64(table.get("getTotalTps"));
                    total_put_tps += put_tps;
                    total_get_tps += get_tps;

                    brokers.push(BrokerMetrics {
                        broker_name,
                        cluster,
                        broker_addr,
                        online: true,
                        version: table
                            .get("brokerVersionDesc")
                            .cloned()
                            .unwrap_or_else(|| "Unknown".to_string()),
                        uptime: table.get("runtime").cloned().unwrap_or_default(),
                        put_tps,
                        get_tps,
                        msg_put_today: parse_i64(table.get("msgPutTotalTodayNow")),
                        msg_get_today: parse_i64(table.get("msgGetTotalTodayNow")),
                        error: None,
                    });
                }
                Err(err) => brokers.push(BrokerMetrics {
                    broker_name,
                    cluster,
                    broker_addr,
                    online: false,
                    version: "Unknown".to_string(),
                    uptime: String::new(),
                    put_tps: 0.0,
                    get_tps: 0.0,
                    msg_put_today: 0,
                    msg_get_today: 0,
                    error: Some(err),
                }),
            }
        }

        Ok(DashboardMetrics {
            brokers,
            total_topics,
            total_groups,
            total_put_tps,
            total_get_tps,
            sampled_at: now_millis(),
        })
    }

    pub fn get_broker_stats_data(
        &self,
        broker_addr: &str,
        stats_key: &str,
        stats_name: &str,
        stats_type: &str,
    ) -> Result<serde_json::Value, String> {
        let mut ext = HashMap::new();
        ext.insert("statsKey".to_string(), stats_key.to_string());
        ext.insert("statsName".to_string(), stats_name.to_string());
        ext.insert("statsType".to_string(), stats_type.to_string());
        let command =
            RemotingCommand::new_request(VIEW_BROKER_STATS_DATA, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(broker_addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Broker stats data is unavailable: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        serde_json::from_slice(&body).map_err(|e| format!("Parse broker stats data failed: {}", e))
    }

    pub fn get_broker_consume_stats(
        &self,
        broker_addr: &str,
        group: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let mut command = RemotingCommand::new_request(GET_BROKER_CONSUME_STATS, next_opaque());
        if let Some(group) = group {
            let mut ext = HashMap::new();
            ext.insert("consumerGroup".to_string(), group.to_string());
            command = command.with_ext_fields(ext);
        }
        let (response, body) = self.send_command_to(broker_addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Broker consume stats are unavailable: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        serde_json::from_slice(&body)
            .map_err(|e| format!("Parse broker consume stats failed: {}", e))
    }

    pub fn get_producer_groups(&self) -> Result<Vec<String>, String> {
        let addrs = self.broker_master_addrs()?;
        let mut groups = BTreeSet::new();
        let mut succeeded = false;
        let mut last_error = None;

        for addr in &addrs {
            let command = RemotingCommand::new_request(GET_ALL_PRODUCER_INFO, next_opaque());
            match self.send_command_to(addr, &command) {
                Ok((response, body)) if response.code == SUCCESS => {
                    match serde_json::from_slice::<ProducerTableInfo>(&body) {
                        Ok(table) => {
                            groups.extend(
                                table
                                    .data
                                    .into_keys()
                                    .map(|group| group.trim().to_string())
                                    .filter(|group| !group.is_empty()),
                            );
                            succeeded = true;
                        }
                        Err(e) => last_error = Some(format!("{}: {}", addr, e)),
                    }
                }
                Ok((response, _)) => {
                    last_error = Some(format!(
                        "{}: code={}, remark={:?}",
                        addr, response.code, response.remark
                    ));
                }
                Err(e) => last_error = Some(format!("{}: {}", addr, e)),
            }
        }

        if !succeeded {
            return Err(last_error.unwrap_or_else(|| "No broker available".to_string()));
        }

        Ok(groups.into_iter().collect())
    }

    pub fn get_producer_connections(
        &self,
        group: &str,
        topic: Option<&str>,
    ) -> Result<Vec<ConnectionInfo>, String> {
        let addrs: Vec<String> = match topic {
            Some(topic) => match self.get_route_info_by_topic(topic) {
                Ok(route) => route
                    .broker_datas
                    .iter()
                    .filter_map(|broker| broker.broker_addrs.get(&0).cloned())
                    .collect(),
                // A topic without a route simply has no producer connections.
                Err(e) if e.contains("code=17") => return Ok(Vec::new()),
                Err(e) => return Err(e),
            },
            None => self.broker_master_addrs()?,
        };

        if addrs.is_empty() {
            return Err("No broker available for the producer group".to_string());
        }

        let mut connections = Vec::new();
        let mut seen = BTreeSet::new();
        let mut responded = false;
        let mut last_error = None;

        for addr in addrs {
            let mut ext = HashMap::new();
            ext.insert("producerGroup".to_string(), group.to_string());
            let command = RemotingCommand::new_request(GET_PRODUCER_CONNECTION_LIST, next_opaque())
                .with_ext_fields(ext);

            match self.send_command_to(&addr, &command) {
                Ok((response, body)) if response.code == SUCCESS => {
                    responded = true;
                    match serde_json::from_slice::<ProducerConnection>(&body) {
                        Ok(parsed) => {
                            for connection in parsed.connection_set {
                                let key = format!("{}|{}", connection.client_id, connection.client_addr);
                                if seen.insert(key) {
                                    connections.push(connection);
                                }
                            }
                        }
                        Err(e) => last_error = Some(format!("{}: {}", addr, e)),
                    }
                }
                Ok((response, _)) => {
                    responded = true;
                    let remark = response.remark.clone().unwrap_or_default();
                    // A broker without this producer group reports "not exist"/"not online".
                    if !remark.contains("not exist") && !remark.contains("not online") {
                        last_error = Some(format!(
                            "{}: code={}, remark={:?}",
                            addr, response.code, response.remark
                        ));
                    }
                }
                Err(e) => last_error = Some(format!("{}: {}", addr, e)),
            }
        }

        if !responded {
            return Err(last_error.unwrap_or_else(|| "No broker available".to_string()));
        }

        Ok(connections)
    }

    fn master_broker_addrs(&self) -> Result<Vec<String>, String> {
        let command = RemotingCommand::new_request(GET_BROKER_CLUSTER_INFO, next_opaque());
        let (response, body) = self.send_command(&command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Get cluster info failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }
        if body.is_empty() {
            return Err("Empty cluster info response".to_string());
        }

        let cluster: ClusterInfoResponse = parse_json_normalized(&body)
            .map_err(|e| format!("Parse cluster info failed: {}", e))?;
        let mut addrs: Vec<String> = cluster
            .broker_addr_table
            .values()
            .filter_map(|broker| broker.broker_addrs.get(&0).cloned())
            .collect();
        addrs.sort();
        addrs.dedup();

        if addrs.is_empty() {
            return Err("No master broker found".to_string());
        }
        Ok(addrs)
    }

    fn fan_out_to_masters<F>(&self, mut operation: F) -> Result<(), String>
    where
        F: FnMut(&str) -> Result<(), String>,
    {
        let addrs = self.master_broker_addrs()?;
        let mut failures = Vec::new();
        let mut succeeded = 0;

        for addr in &addrs {
            match operation(addr) {
                Ok(()) => succeeded += 1,
                Err(e) => failures.push(format!("{}: {}", addr, e)),
            }
        }

        if failures.is_empty() {
            Ok(())
        } else if succeeded == 0 {
            Err(failures.join("; "))
        } else {
            Err(format!(
                "Applied to {} of {} brokers; failed: {}",
                succeeded,
                addrs.len(),
                failures.join("; ")
            ))
        }
    }

    fn broker_acl_users(&self, addr: &str, filter: &str) -> Result<Vec<UserInfo>, String> {
        let mut ext = HashMap::new();
        ext.insert("filter".to_string(), filter.to_string());
        let command =
            RemotingCommand::new_request(AUTH_LIST_USER, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "List ACL users failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }
        if body.is_empty() {
            return Ok(Vec::new());
        }

        serde_json::from_slice(&body).map_err(|e| format!("Parse ACL users failed: {}", e))
    }

    pub fn list_acl_users(&self, filter: &str) -> Result<Vec<BrokerAclUsers>, String> {
        let addrs = self.master_broker_addrs()?;
        let mut results = Vec::new();

        for addr in addrs {
            match self.broker_acl_users(&addr, filter) {
                Ok(users) => results.push(BrokerAclUsers {
                    broker_addr: addr,
                    users,
                    error: None,
                }),
                Err(e) => results.push(BrokerAclUsers {
                    broker_addr: addr,
                    users: Vec::new(),
                    error: Some(e),
                }),
            }
        }

        Ok(results)
    }

    fn send_acl_user(&self, code: i32, user: &UserInfo) -> Result<(), String> {
        let body = serde_json::to_vec(user)
            .map_err(|e| format!("Encode ACL user failed: {}", e))?;
        let username = user.username.clone();

        self.fan_out_to_masters(move |addr| {
            let mut ext = HashMap::new();
            ext.insert("username".to_string(), username.clone());
            let command = RemotingCommand::new_request(code, next_opaque()).with_ext_fields(ext);
            let (response, _) = self.send_raw_to(addr, &command, &body)?;

            if response.code != SUCCESS {
                return Err(format!(
                    "Save ACL user failed: code={}, remark={:?}",
                    response.code, response.remark
                ));
            }
            Ok(())
        })
    }

    pub fn create_acl_user(&self, user: &UserInfo) -> Result<(), String> {
        self.send_acl_user(AUTH_CREATE_USER, user)
    }

    pub fn update_acl_user(&self, user: &UserInfo) -> Result<(), String> {
        self.send_acl_user(AUTH_UPDATE_USER, user)
    }

    pub fn delete_acl_user(&self, username: &str) -> Result<(), String> {
        let username = username.to_string();

        self.fan_out_to_masters(move |addr| {
            let mut ext = HashMap::new();
            ext.insert("username".to_string(), username.clone());
            let command =
                RemotingCommand::new_request(AUTH_DELETE_USER, next_opaque()).with_ext_fields(ext);
            let (response, _) = self.send_command_to(addr, &command)?;

            if response.code != SUCCESS {
                return Err(format!(
                    "Delete ACL user failed: code={}, remark={:?}",
                    response.code, response.remark
                ));
            }
            Ok(())
        })
    }

    fn broker_acl_rules(
        &self,
        addr: &str,
        subject: &str,
        resource: &str,
    ) -> Result<Vec<AclInfo>, String> {
        let mut ext = HashMap::new();
        ext.insert("subjectFilter".to_string(), subject.to_string());
        ext.insert("resourceFilter".to_string(), resource.to_string());
        let command =
            RemotingCommand::new_request(AUTH_LIST_ACL, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "List ACL rules failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }
        if body.is_empty() {
            return Ok(Vec::new());
        }

        serde_json::from_slice(&body).map_err(|e| format!("Parse ACL rules failed: {}", e))
    }

    pub fn list_acl_rules(
        &self,
        subject: &str,
        resource: &str,
    ) -> Result<Vec<BrokerAclRules>, String> {
        let addrs = self.master_broker_addrs()?;
        let mut results = Vec::new();

        for addr in addrs {
            match self.broker_acl_rules(&addr, subject, resource) {
                Ok(rules) => results.push(BrokerAclRules {
                    broker_addr: addr,
                    rules,
                    error: None,
                }),
                Err(e) => results.push(BrokerAclRules {
                    broker_addr: addr,
                    rules: Vec::new(),
                    error: Some(e),
                }),
            }
        }

        Ok(results)
    }

    fn send_acl_rule(&self, code: i32, acl: &AclInfo) -> Result<(), String> {
        let body = serde_json::to_vec(acl)
            .map_err(|e| format!("Encode ACL rule failed: {}", e))?;
        let subject = acl.subject.clone();

        self.fan_out_to_masters(move |addr| {
            let mut ext = HashMap::new();
            ext.insert("subject".to_string(), subject.clone());
            let command = RemotingCommand::new_request(code, next_opaque()).with_ext_fields(ext);
            let (response, _) = self.send_raw_to(addr, &command, &body)?;

            if response.code != SUCCESS {
                return Err(format!(
                    "Save ACL rule failed: code={}, remark={:?}",
                    response.code, response.remark
                ));
            }
            Ok(())
        })
    }

    pub fn create_acl_rule(&self, acl: &AclInfo) -> Result<(), String> {
        self.send_acl_rule(AUTH_CREATE_ACL, acl)
    }

    pub fn update_acl_rule(&self, acl: &AclInfo) -> Result<(), String> {
        self.send_acl_rule(AUTH_UPDATE_ACL, acl)
    }

    pub fn delete_acl_rule(&self, subject: &str, resource: &str) -> Result<(), String> {
        let subject = subject.to_string();
        let resource = resource.to_string();

        self.fan_out_to_masters(move |addr| {
            let mut ext = HashMap::new();
            ext.insert("subject".to_string(), subject.clone());
            ext.insert("resource".to_string(), resource.clone());
            let command =
                RemotingCommand::new_request(AUTH_DELETE_ACL, next_opaque()).with_ext_fields(ext);
            let (response, _) = self.send_command_to(addr, &command)?;

            if response.code != SUCCESS {
                return Err(format!(
                    "Delete ACL rule failed: code={}, remark={:?}",
                    response.code, response.remark
                ));
            }
            Ok(())
        })
    }
}

fn parse_first_f64(raw: Option<&String>) -> f64 {
    raw.and_then(|value| value.split_whitespace().next())
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(0.0)
}

fn parse_i64(raw: Option<&String>) -> i64 {
    raw.and_then(|value| value.parse::<i64>().ok()).unwrap_or(0)
}

/// Parse one trace message body. Contexts are separated by STX and fields by SOH.
/// The first field of each context is the trace type; layouts follow RocketMQ 5.x
/// TraceDataEncoder (the msgId column is 5, except 2 for SubAfter).
fn parse_trace_body(encoded_body: &str, target_msg_id: Option<&str>, record: &mut TraceRecord) {
    let bytes = decode_body(encoded_body);
    let data = String::from_utf8_lossy(&bytes);
    for context in data.split(TRACE_FIELD_SPLITOR) {
        if context.is_empty() {
            continue;
        }
        let fields: Vec<&str> = context.split(TRACE_CONTENT_SPLITOR).collect();
        let trace_type = fields[0].trim();
        let msg_id_index = if trace_type == "SubAfter" { 2 } else { 5 };
        if let Some(target) = target_msg_id {
            if trace_field(&fields, msg_id_index) != target {
                continue;
            }
        }

        match trace_type {
            "Pub" => record.nodes.push(TraceNode {
                title: "produce".to_string(),
                timestamp: trace_long(&fields, 1),
                status: trace_status(trace_bool(&fields, 13)),
                cost_time: trace_long(&fields, 10),
                description: format!(
                    "producer={}, storeHost={}",
                    trace_field(&fields, 3),
                    trace_field(&fields, 8)
                ),
            }),
            "SubAfter" => {
                record.nodes.push(TraceNode {
                    title: "consume".to_string(),
                    timestamp: trace_long(&fields, 7),
                    status: trace_status(trace_bool(&fields, 4)),
                    cost_time: trace_long(&fields, 3),
                    description: format!(
                        "group={}, contextCode={}",
                        trace_field(&fields, 8),
                        trace_field(&fields, 6)
                    ),
                });
                record.consumer_status.push(ConsumerStatus {
                    group: trace_field(&fields, 8).to_string(),
                    delivery_status: if trace_bool(&fields, 4) {
                        "success"
                    } else {
                        "failed"
                    }
                    .to_string(),
                    consume_time: trace_long(&fields, 7),
                    retry_count: 0,
                });
            }
            "EndTransaction" => record.nodes.push(TraceNode {
                title: "endTransaction".to_string(),
                timestamp: trace_long(&fields, 1),
                status: "finish".to_string(),
                cost_time: 0,
                description: format!(
                    "group={}, transactionState={}",
                    trace_field(&fields, 3),
                    trace_field(&fields, 11)
                ),
            }),
            "Recall" => record.nodes.push(TraceNode {
                title: "recall".to_string(),
                timestamp: trace_long(&fields, 1),
                status: trace_status(trace_bool(&fields, 6)),
                cost_time: 0,
                description: format!(
                    "group={}, topic={}",
                    trace_field(&fields, 3),
                    trace_field(&fields, 4)
                ),
            }),
            _ => {}
        }
    }
}

fn trace_field<'a>(fields: &[&'a str], index: usize) -> &'a str {
    fields.get(index).copied().unwrap_or("")
}

fn trace_long(fields: &[&str], index: usize) -> i64 {
    trace_field(fields, index).parse().unwrap_or(0)
}

fn trace_bool(fields: &[&str], index: usize) -> bool {
    trace_field(fields, index).eq_ignore_ascii_case("true")
}

fn trace_status(success: bool) -> String {
    if success { "finish" } else { "failed" }.to_string()
}

fn decode_body(encoded: &str) -> Vec<u8> {
    general_purpose::STANDARD
        .decode(encoded)
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(encoded))
        .unwrap_or_else(|_| encoded.as_bytes().to_vec())
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// RocketMQ serializes message properties as `key\u{0001}value\u{0002}...`,
/// so values must not contain either separator.
fn validate_property_value(field: &str, value: &str) -> Result<(), String> {
    if value.contains('\u{0001}') || value.contains('\u{0002}') {
        return Err(format!(
            "Message {} must not contain control characters \\u0001 or \\u0002",
            field
        ));
    }
    Ok(())
}

fn describe_failure(context: &str, code: i32, remark: &Option<String>) -> String {
    match remark {
        Some(remark) => format!("{}: code={}, {}", context, code, remark),
        None => format!("{}: code={}", context, code),
    }
}

fn parse_messages(body: &[u8]) -> Result<Vec<MessageExt>, String> {
    if body.is_empty() {
        return Ok(Vec::new());
    }

    // Some setups serialize messages as JSON; brokers normally return the raw
    // commitlog message format, so fall back to binary decoding.
    if let Ok(messages) = serde_json::from_slice::<Vec<MessageExt>>(body) {
        return Ok(messages);
    }

    if let Ok(message) = serde_json::from_slice::<MessageExt>(body) {
        return Ok(vec![message]);
    }

    decode_store_messages(body)
}

const MIN_STORE_MESSAGE_SIZE: usize = 91; // 88-byte fixed header + topic/properties lengths

fn decode_store_messages(body: &[u8]) -> Result<Vec<MessageExt>, String> {
    let mut messages = Vec::new();
    let mut position = 0usize;
    while position + 4 <= body.len() {
        let total_size = i32::from_be_bytes([
            body[position],
            body[position + 1],
            body[position + 2],
            body[position + 3],
        ]) as usize;
        if total_size < MIN_STORE_MESSAGE_SIZE || position + total_size > body.len() {
            break;
        }
        messages.push(decode_store_message(&body[position..position + total_size])?);
        position += total_size;
    }

    if messages.is_empty() {
        Err("Failed to parse message response".to_string())
    } else {
        Ok(messages)
    }
}

fn decode_store_message(data: &[u8]) -> Result<MessageExt, String> {
    if data.len() < MIN_STORE_MESSAGE_SIZE {
        return Err("Message body too short".to_string());
    }

    let read_i32 = |offset: usize| i32::from_be_bytes(data[offset..offset + 4].try_into().unwrap());
    let read_i64 = |offset: usize| i64::from_be_bytes(data[offset..offset + 8].try_into().unwrap());

    let queue_id = read_i32(12);
    let flag = read_i32(16);
    let queue_offset = read_i64(20);
    let physical_offset = read_i64(28);
    let sys_flag = read_i32(36);
    let born_timestamp = read_i64(40);
    let born_host = format_message_host(&data[48..56]);
    let store_timestamp = read_i64(56);
    let store_host_bytes = &data[64..72];
    let store_host = format_message_host(store_host_bytes);
    let reconsume_times = read_i32(72);
    let body_length = read_i32(84) as usize;

    let body_start = 88usize;
    if body_start + body_length + 3 > data.len() {
        return Err("Message body length out of range".to_string());
    }
    let body = &data[body_start..body_start + body_length];

    let topic_start = body_start + body_length;
    let topic_length = data[topic_start] as usize;
    if topic_start + 1 + topic_length + 2 > data.len() {
        return Err("Message topic length out of range".to_string());
    }
    let topic = String::from_utf8_lossy(&data[topic_start + 1..topic_start + 1 + topic_length]).to_string();

    let properties_start = topic_start + 1 + topic_length;
    let properties_length =
        u16::from_be_bytes([data[properties_start], data[properties_start + 1]]) as usize;
    if properties_start + 2 + properties_length > data.len() {
        return Err("Message properties length out of range".to_string());
    }
    let properties_text =
        String::from_utf8_lossy(&data[properties_start + 2..properties_start + 2 + properties_length]);

    Ok(MessageExt {
        topic: Some(topic),
        flag: Some(flag),
        properties: Some(parse_message_properties(&properties_text)),
        body: Some(general_purpose::STANDARD.encode(body)),
        queue_id: Some(queue_id),
        queue_offset: Some(queue_offset),
        commit_log_offset: Some(physical_offset),
        sys_flag: Some(sys_flag),
        born_timestamp: Some(born_timestamp),
        born_host: Some(born_host),
        store_timestamp: Some(store_timestamp),
        store_host: Some(store_host),
        msg_id: Some(build_message_id(store_host_bytes, physical_offset)),
        reconsume_times: Some(reconsume_times),
    })
}

fn format_message_host(bytes: &[u8]) -> String {
    if bytes.len() < 8 {
        return String::new();
    }
    format!(
        "{}.{}.{}.{}:{}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        i32::from_be_bytes([bytes[4], bytes[5], bytes[6], bytes[7]])
    )
}

fn build_message_id(store_host: &[u8], physical_offset: i64) -> String {
    let mut bytes = Vec::with_capacity(16);
    bytes.extend_from_slice(&store_host[..8]);
    bytes.extend_from_slice(&physical_offset.to_be_bytes());
    bytes.iter().map(|byte| format!("{:02X}", byte)).collect()
}

fn parse_message_properties(raw: &str) -> HashMap<String, String> {
    raw.split('\u{0002}')
        .filter(|entry| !entry.is_empty())
        .filter_map(|entry| {
            let mut parts = entry.splitn(2, '\u{0001}');
            let key = parts.next()?;
            let value = parts.next()?;
            Some((key.to_string(), value.to_string()))
        })
        .collect()
}

fn decode_msg_id(msg_id: &str) -> Result<(String, i64), String> {
    if msg_id.len() != 32 {
        return Err("Invalid message ID: expected 32 hex characters".to_string());
    }

    let bytes: Vec<u8> = (0..16)
        .map(|i| {
            u8::from_str_radix(&msg_id[i * 2..i * 2 + 2], 16)
                .map_err(|_| "Invalid message ID hex".to_string())
        })
        .collect::<Result<_, _>>()?;

    let ip = format!("{}.{}.{}.{}", bytes[0], bytes[1], bytes[2], bytes[3]);
    let port = i32::from_be_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
    let offset = i64::from_be_bytes([
        bytes[8], bytes[9], bytes[10], bytes[11],
        bytes[12], bytes[13], bytes[14], bytes[15],
    ]);
    Ok((format!("{}:{}", ip, port), offset))
}

fn normalize_json_keys(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::with_capacity(s.len() + 16);
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '{' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit() {
            let start = i + 1;
            let mut j = start;
            while j < chars.len() && chars[j].is_ascii_digit() {
                j += 1;
            }
            if j < chars.len() && chars[j] == ':' {
                out.push('{');
                out.push('"');
                out.extend(&chars[start..j]);
                out.push('"');
                out.push(':');
                i = j + 1;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

fn parse_json_normalized<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T, String> {
    let s = String::from_utf8(body.to_vec())
        .map_err(|e| format!("Invalid UTF-8 response: {}", e))?;
    let normalized = normalize_json_keys(&s);
    serde_json::from_str::<T>(&normalized).map_err(|e| format!("Parse JSON failed: {}", e))
}

#[cfg(test)]
mod smoke {
    use super::*;

    #[test]
    fn rejects_property_separators() {
        assert!(validate_property_value("tag", "ok").is_ok());
        assert!(validate_property_value("tag", "bad\u{0001}value").is_err());
        assert!(validate_property_value("key", "bad\u{0002}value").is_err());
    }

    #[test]
    fn parses_trace_contexts() {
        let msg_id = "AC14000A00002A9F0000000000000001";
        let pub_ctx = [
            "Pub",
            "1700000000000",
            "DefaultRegion",
            "producer_group",
            "TestTopic",
            msg_id,
            "tagA",
            "keyA",
            "10.0.0.1:10911",
            "100",
            "12",
            "NORMAL",
            "10.0.0.1:10911",
            "true",
        ]
        .join(&TRACE_CONTENT_SPLITOR.to_string());
        let sub_ctx = [
            "SubAfter",
            "req-1",
            msg_id,
            "8",
            "true",
            "keyA",
            "0",
            "1700000000500",
            "consumer_group",
        ]
        .join(&TRACE_CONTENT_SPLITOR.to_string());
        let raw = format!("{}{}{}", pub_ctx, TRACE_FIELD_SPLITOR, sub_ctx);
        let encoded = general_purpose::STANDARD.encode(raw.as_bytes());

        let mut record = TraceRecord::default();
        parse_trace_body(&encoded, Some(msg_id), &mut record);

        assert_eq!(record.nodes.len(), 2);
        assert_eq!(record.nodes[0].title, "produce");
        assert_eq!(record.nodes[0].status, "finish");
        assert_eq!(record.nodes[0].cost_time, 12);
        assert_eq!(record.nodes[0].description, "producer=producer_group, storeHost=10.0.0.1:10911");
        assert_eq!(record.nodes[1].title, "consume");
        assert_eq!(record.nodes[1].timestamp, 1700000000500);
        assert_eq!(record.nodes[1].description, "group=consumer_group, contextCode=0");

        assert_eq!(record.consumer_status.len(), 1);
        assert_eq!(record.consumer_status[0].group, "consumer_group");
        assert_eq!(record.consumer_status[0].delivery_status, "success");

        let mut filtered = TraceRecord::default();
        parse_trace_body(&encoded, Some("OTHER"), &mut filtered);
        assert!(filtered.nodes.is_empty());
        assert!(filtered.consumer_status.is_empty());
    }
}

/// Live end-to-end checks. Run explicitly against a reachable test cluster:
/// `cargo test live_topic_lifecycle -- --ignored --nocapture`
#[cfg(test)]
mod live {
    use super::*;

    fn test_client() -> RocketMQClient {
        let addr = std::env::var("ROCKETMQ_TEST_NAMESERVER")
            .unwrap_or_else(|_| "127.0.0.1:9876".to_string());
        RocketMQClient::new(ConnectionConfig {
            name_server_addrs: vec![addr],
            acl_enabled: false,
            access_key: None,
            secret_key: None,
        })
        .expect("client")
    }

    #[test]
    #[ignore = "requires a live RocketMQ test cluster (set ROCKETMQ_TEST_NAMESERVER)"]
    fn live_topic_status_readonly() {
        let client = test_client();
        let topics = client.get_topic_list().expect("topic list");
        let topic = topics
            .iter()
            .find(|t| {
                !t.starts_with('%')
                    && !t.starts_with("TBW")
                    && !t.starts_with("RMQ_SYS")
                    && !t.starts_with("rmq_sys")
                    && !t.starts_with("SCHEDULE_TOPIC")
            })
            .cloned()
            .expect("a user topic");
        let status = client.get_topic_status(&topic).expect("topic status");
        assert!(!status.queues.is_empty(), "no queues for {}", topic);
        assert!(status.errors.is_empty(), "errors: {:?}", status.errors);
        println!(
            "status for {}: {} queues, {} messages",
            topic,
            status.queues.len(),
            status.total_messages
        );
    }

    #[test]
    #[ignore = "requires a live RocketMQ test cluster (set ROCKETMQ_TEST_NAMESERVER)"]
    fn live_topic_lifecycle_and_send() {
        let client = test_client();
        let topic = format!("ClaudeE2E_{}", now_millis());

        let cluster = client.get_cluster_info().expect("cluster info");
        let broker_addr = cluster
            .brokers
            .iter()
            .find_map(|b| b.master_addr.clone())
            .expect("master broker");

        client
            .create_topic(&topic, &broker_addr, 2, 2, 6)
            .expect("create topic");

        let mut route_ready = false;
        for _ in 0..45 {
            if client.get_route_info_by_topic(&topic).is_ok() {
                route_ready = true;
                break;
            }
            std::thread::sleep(Duration::from_secs(1));
        }
        assert!(route_ready, "topic route was not registered in time");

        let update = client
            .update_topic(&topic, 4, 4, 6, None)
            .expect("update topic");
        assert!(!update.updated_brokers.is_empty());
        assert!(update.errors.is_empty(), "update errors: {:?}", update.errors);

        let sent = client
            .send_message(&topic, "hello from the dashboard e2e test", Some("e2e"), Some("key-1"), None, None)
            .expect("send message");
        assert!(!sent.msg_id.is_empty(), "missing msgId");
        assert!(sent.queue_offset >= 0, "missing queue offset: {:?}", sent);

        std::thread::sleep(Duration::from_millis(500));
        let route = client
            .get_route_info_by_topic(&topic)
            .expect("route after send");
        let expected_queues: i32 = route.queue_datas.iter().map(|q| q.read_queue_nums).sum();
        let status = client.get_topic_status(&topic).expect("topic status");
        assert_eq!(status.queues.len() as i32, expected_queues);
        assert!(
            status.total_messages >= 1,
            "expected at least one stored message, got {}",
            status.total_messages
        );

        client.delete_topic(&topic).expect("delete topic");
    }
}
