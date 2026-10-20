use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;
use std::sync::atomic::{AtomicI32, Ordering};

use super::protocol::{
    RemotingCommand, ClusterInfoResponse, TopicListResponse, TopicRouteData, MessageExt,
    SubscriptionGroupListResponse, ConsumerConnection,
    GET_BROKER_CLUSTER_INFO, GET_ALL_TOPIC_LIST_FROM_NAMESERVER, GET_ROUTEINFO_BY_TOPIC,
    QUERY_MESSAGE, VIEW_MESSAGE_BY_ID, SEARCH_OFFSET_BY_TIMESTAMP, UPDATE_AND_CREATE_TOPIC,
    DELETE_TOPIC_IN_NAMESRV, DELETE_TOPIC_IN_BROKER, SUCCESS,
    GET_ALL_SUBSCRIPTIONGROUP_CONFIG, GET_CONSUMER_CONNECTION_LIST, QUERY_CONSUMER_OFFSET,
    UPDATE_CONSUMER_OFFSET, GET_MAX_OFFSET, GET_MIN_OFFSET,
};

static OPAQUE_COUNTER: AtomicI32 = AtomicI32::new(1);

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
}

#[derive(Debug, Clone, Serialize)]
pub struct ClusterInfo {
    pub brokers: Vec<BrokerInfo>,
    pub total_topics: u32,
    pub total_groups: u32,
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
}

impl RocketMQClient {
    pub fn new(config: ConnectionConfig) -> Result<Self, String> {
        if config.name_server_addrs.is_empty() {
            return Err("NameServer address list cannot be empty".to_string());
        }

        Ok(Self {
            name_server_addrs: config.name_server_addrs,
            current_addr_index: 0,
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
            let addrs: Vec<String> = broker_data
                .broker_addrs
                .values()
                .map(|s| s.clone())
                .collect();

            brokers.push(BrokerInfo {
                broker_name: broker_data.broker_name.clone(),
                cluster_name: broker_data.cluster.clone(),
                broker_addrs: addrs,
                version: "Unknown".to_string(),
                online: true,
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
