use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;
use std::sync::atomic::{AtomicI32, Ordering};

use super::protocol::{
    RemotingCommand, ClusterInfoResponse, TopicListResponse, TopicRouteData, MessageExt,
    GET_BROKER_CLUSTER_INFO, GET_ALL_TOPIC_LIST_FROM_NAMESERVER, GET_ROUTEINFO_BY_TOPIC,
    QUERY_MESSAGE, VIEW_MESSAGE_BY_ID, SUCCESS,
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

        let cluster_response: ClusterInfoResponse = serde_json::from_slice(&body)
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

        let route: TopicRouteData = serde_json::from_slice(&body)
            .map_err(|e| format!("Parse route info failed: {}", e))?;

        Ok(route)
    }

    fn broker_addr_for_topic(&self, topic: &str) -> Result<String, String> {
        let route = self.get_route_info_by_topic(topic)?;
        route
            .broker_datas
            .first()
            .and_then(|b| b.broker_addrs.get("0"))
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
