use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::sync::atomic::{AtomicI32, Ordering};

use base64::{engine::general_purpose, Engine as _};

use super::protocol::{
    RemotingCommand, ClusterInfoResponse, TopicListResponse, TopicRouteData, MessageExt,
    SubscriptionGroupListResponse, ConsumerConnection, TraceNode, ConsumerStatus, TraceRecord,
    GET_BROKER_CLUSTER_INFO, GET_ALL_TOPIC_LIST_FROM_NAMESERVER, GET_ROUTEINFO_BY_TOPIC,
    QUERY_MESSAGE, VIEW_MESSAGE_BY_ID, SEARCH_OFFSET_BY_TIMESTAMP, UPDATE_AND_CREATE_TOPIC,
    DELETE_TOPIC_IN_NAMESRV, DELETE_TOPIC_IN_BROKER, SUCCESS,
    GET_ALL_SUBSCRIPTIONGROUP_CONFIG, GET_CONSUMER_CONNECTION_LIST, QUERY_CONSUMER_OFFSET,
    UPDATE_CONSUMER_OFFSET, GET_MAX_OFFSET, GET_MIN_OFFSET,
    DEFAULT_TRACE_TOPIC, TRACE_CONTENT_SPLITOR, TRACE_FIELD_SPLITOR,
    TOPIC_NOT_EXIST, QUERY_NOT_FOUND, NO_MESSAGE,
    GET_BROKER_RUNTIME_INFO, VIEW_BROKER_STATS_DATA, GET_BROKER_CONSUME_STATS,
};

static OPAQUE_COUNTER: AtomicI32 = AtomicI32::new(1);

const TRACE_QUERY_MAX: i32 = 64;
const ONE_HOUR_MILLIS: i64 = 3_600_000;
const ONE_DAY_MILLIS: i64 = 86_400_000;

fn next_opaque() -> i32 {
    OPAQUE_COUNTER.fetch_add(1, Ordering::SeqCst)
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

pub struct RocketMQClient {
    name_server_addrs: Vec<String>,
    current_addr_index: usize,
    group_count_cache: std::sync::Mutex<Option<(std::time::Instant, u32)>>,
}

impl RocketMQClient {
    pub fn new(config: ConnectionConfig) -> Result<Self, String> {
        if config.name_server_addrs.is_empty() {
            return Err("NameServer address list cannot be empty".to_string());
        }

        Ok(Self {
            name_server_addrs: config.name_server_addrs,
            current_addr_index: 0,
            group_count_cache: std::sync::Mutex::new(None),
        })
    }

    fn get_current_addr(&self) -> &str {
        &self.name_server_addrs[self.current_addr_index]
    }

    fn send_command_to(&self, addr: &str, command: &RemotingCommand) -> Result<(RemotingCommand, Vec<u8>), String> {
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

        let request_data = command.encode()?;
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

    pub fn send_generic_request(&self, request_code: i32, ext_fields: HashMap<String, String>) -> Result<(RemotingCommand, Vec<u8>), String> {
        let command = RemotingCommand::new_request(request_code, next_opaque())
            .with_ext_fields(ext_fields);
        self.send_command(&command)
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
            return Err(format!(
                "Get route info failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        if body.is_empty() {
            return Err("Empty route info response".to_string());
        }

        let route: TopicRouteData = parse_json_normalized(&body)
            .map_err(|e| format!("Parse route info failed: {}", e))?;

        Ok(route)
    }

    fn broker_addr_for_topic(&self, topic: &str) -> Result<String, String> {
        let route = self.get_route_info_by_topic(topic)?;
        route
            .broker_datas
            .first()
            .and_then(|b| b.broker_addrs.get(&0))
            .cloned()
            .ok_or_else(|| format!("No broker found for topic: {}", topic))
    }

    pub fn query_message_by_key(&self, topic: &str, key: &str) -> Result<Vec<MessageExt>, String> {
        let broker_addr = self.broker_addr_for_topic(topic)?;
        let mut ext = HashMap::new();
        ext.insert("topic".to_string(), topic.to_string());
        ext.insert("key".to_string(), key.to_string());
        ext.insert("maxNum".to_string(), "32".to_string());
        ext.insert("beginTimestamp".to_string(), "0".to_string());
        ext.insert("endTimestamp".to_string(), "9999999999999".to_string());
        let command = RemotingCommand::new_request(QUERY_MESSAGE, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(&broker_addr, &command)?;

        if response.code != SUCCESS {
            return Err(format!(
                "Query message by key failed: code={}, remark={:?}",
                response.code, response.remark
            ));
        }

        parse_messages(&body)
    }

    pub fn query_message_by_id(&self, msg_id: &str) -> Result<Vec<MessageExt>, String> {
        let broker_addr = parse_msg_id_addr(msg_id)?;
        let mut ext = HashMap::new();
        ext.insert("msgId".to_string(), msg_id.to_string());
        let command = RemotingCommand::new_request(VIEW_MESSAGE_BY_ID, next_opaque()).with_ext_fields(ext);
        let (response, body) = self.send_command_to(&broker_addr, &command)?;

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

    pub fn query_message_by_time(&self, topic: &str, begin_ts: i64, end_ts: i64) -> Result<Vec<MessageExt>, String> {
        let broker_addr = self.broker_addr_for_topic(topic)?;
        let route = self.get_route_info_by_topic(topic)?;
        let read_queue_nums = route.queue_datas.first().map(|q| q.read_queue_nums).unwrap_or(4) as i32;
        let mut all = Vec::new();

        for queue_id in 0..read_queue_nums {
            let begin_offset = match self.search_offset(&broker_addr, topic, queue_id, begin_ts) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let end_offset = match self.search_offset(&broker_addr, topic, queue_id, end_ts) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if begin_offset < 0 || end_offset < begin_offset {
                continue;
            }
            let max_num = (end_offset - begin_offset + 1).min(32);
            if max_num <= 0 {
                continue;
            }

            let mut ext = HashMap::new();
            ext.insert("topic".to_string(), topic.to_string());
            ext.insert("queueId".to_string(), queue_id.to_string());
            ext.insert("offset".to_string(), begin_offset.to_string());
            ext.insert("maxNum".to_string(), max_num.to_string());
            ext.insert("beginTimestamp".to_string(), begin_ts.to_string());
            ext.insert("endTimestamp".to_string(), end_ts.to_string());
            let command = RemotingCommand::new_request(QUERY_MESSAGE, next_opaque()).with_ext_fields(ext);
            let (response, body) = match self.send_command_to(&broker_addr, &command) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if response.code != SUCCESS {
                continue;
            }
            if let Ok(mut msgs) = parse_messages(&body) {
                all.append(&mut msgs);
            }
        }

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

fn parse_messages(body: &[u8]) -> Result<Vec<MessageExt>, String> {
    if body.is_empty() {
        return Ok(Vec::new());
    }

    if let Ok(messages) = serde_json::from_slice::<Vec<MessageExt>>(body) {
        return Ok(messages);
    }

    if let Ok(message) = serde_json::from_slice::<MessageExt>(body) {
        return Ok(vec![message]);
    }

    Err("Failed to parse message response".to_string())
}

fn parse_msg_id_addr(msg_id: &str) -> Result<String, String> {
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
    Ok(format!("{}:{}", ip, port))
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
