use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// RocketMQ Request Codes (verified against broker 4.7.7 test cluster)
pub const GET_BROKER_CLUSTER_INFO: i32 = 106;
pub const GET_ALL_TOPIC_LIST_FROM_NAMESERVER: i32 = 206;
pub const GET_ROUTEINFO_BY_TOPIC: i32 = 105;
pub const QUERY_MESSAGE: i32 = 12;
pub const PULL_MESSAGE: i32 = 11;
pub const VIEW_MESSAGE_BY_ID: i32 = 33;
pub const SEARCH_OFFSET_BY_TIMESTAMP: i32 = 29;
pub const UPDATE_AND_CREATE_TOPIC: i32 = 17;
pub const DELETE_TOPIC_IN_NAMESRV: i32 = 216;
pub const DELETE_TOPIC_IN_BROKER: i32 = 215;

// ACL 2.0 request codes (RocketMQ 5.3+)
pub const AUTH_CREATE_USER: i32 = 3001;
pub const AUTH_UPDATE_USER: i32 = 3002;
pub const AUTH_DELETE_USER: i32 = 3003;
pub const AUTH_LIST_USER: i32 = 3005;
pub const AUTH_CREATE_ACL: i32 = 3006;
pub const AUTH_UPDATE_ACL: i32 = 3007;
pub const AUTH_DELETE_ACL: i32 = 3008;
pub const AUTH_LIST_ACL: i32 = 3010;
pub const GET_BROKER_RUNTIME_INFO: i32 = 28;
pub const VIEW_BROKER_STATS_DATA: i32 = 107;
pub const GET_BROKER_CONSUME_STATS: i32 = 109;

// Consumer admin
pub const GET_ALL_SUBSCRIPTIONGROUP_CONFIG: i32 = 201;
pub const GET_CONSUMER_CONNECTION_LIST: i32 = 203;
pub const QUERY_CONSUMER_OFFSET: i32 = 14;
pub const UPDATE_CONSUMER_OFFSET: i32 = 15;
pub const GET_MAX_OFFSET: i32 = 30;
pub const GET_MIN_OFFSET: i32 = 31;

// Producer admin
pub const GET_PRODUCER_CONNECTION_LIST: i32 = 204;
pub const GET_ALL_PRODUCER_INFO: i32 = 328;

// Message send
pub const SEND_MESSAGE: i32 = 10;
pub const SEND_MESSAGE_V2: i32 = 310;
pub const REQUEST_CODE_NOT_SUPPORTED: i32 = 3;

// Message trace
pub const DEFAULT_TRACE_TOPIC: &str = "RMQ_SYS_TRACE_TOPIC";
// Trace contexts are separated by STX, their fields by SOH (RocketMQ TraceConstants)
pub const TRACE_FIELD_SPLITOR: char = '\u{0002}';
pub const TRACE_CONTENT_SPLITOR: char = '\u{0001}';

// Response Codes
pub const SUCCESS: i32 = 0;
pub const TOPIC_NOT_EXIST: i32 = 17;
pub const QUERY_NOT_FOUND: i32 = 22;
pub const NO_MESSAGE: i32 = 204;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemotingCommand {
    pub code: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i32>,
    pub opaque: i32,
    pub flag: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
    #[serde(rename = "extFields", skip_serializing_if = "Option::is_none")]
    pub ext_fields: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "serializeTypeCurrentRPC")]
    pub serialize_type: Option<String>,
}

impl RemotingCommand {
    pub fn new_request(code: i32, opaque: i32) -> Self {
        Self {
            code,
            language: Some("RUST".to_string()),
            version: Some(0),
            opaque,
            flag: 0,
            remark: None,
            ext_fields: None,
            serialize_type: Some("JSON".to_string()),
        }
    }

    pub fn with_ext_fields(mut self, fields: HashMap<String, String>) -> Self {
        self.ext_fields = Some(fields);
        self
    }

    pub fn encode_with_body(&self, body: &[u8]) -> Result<Vec<u8>, String> {
        let header_json = serde_json::to_string(self)
            .map_err(|e| format!("Serialize header failed: {}", e))?;
        let header_bytes = header_json.as_bytes();

        // Protocol format:
        // 4 bytes: total length (header length marker + header + body)
        // 4 bytes: header length (with serialization type in high byte)
        // N bytes: header JSON
        // M bytes: body

        let header_len = header_bytes.len() as i32;
        let total_len = 4 + header_len + body.len() as i32;

        let mut buffer = Vec::with_capacity(total_len as usize + 4);

        // Total length (big endian)
        buffer.extend_from_slice(&total_len.to_be_bytes());

        // Header length with serialization type (0 = JSON in high byte)
        let header_len_with_type = header_len | (0 << 24);
        buffer.extend_from_slice(&header_len_with_type.to_be_bytes());

        // Header
        buffer.extend_from_slice(header_bytes);

        // Body
        buffer.extend_from_slice(body);

        Ok(buffer)
    }

    pub fn decode(data: &[u8]) -> Result<(Self, Vec<u8>), String> {
        if data.len() < 4 {
            return Err("Invalid data length".to_string());
        }

        // Read header length
        let header_len_with_type = i32::from_be_bytes([data[0], data[1], data[2], data[3]]);
        let header_len = (header_len_with_type & 0x00FFFFFF) as usize;
        
        if data.len() < 4 + header_len {
            return Err("Incomplete header data".to_string());
        }

        // Parse header JSON
        let header_json = &data[4..4 + header_len];
        let command: RemotingCommand = serde_json::from_slice(header_json)
            .map_err(|e| format!("Deserialize header failed: {}", e))?;

        // Body (remaining bytes)
        let body = if data.len() > 4 + header_len {
            data[4 + header_len..].to_vec()
        } else {
            Vec::new()
        };

        Ok((command, body))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokerData {
    pub cluster: String,
    #[serde(rename = "brokerName")]
    pub broker_name: String,
    #[serde(rename = "brokerAddrs")]
    pub broker_addrs: HashMap<i64, String>, // broker id -> "ip:port" (0=master)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterInfoResponse {
    #[serde(rename = "brokerAddrTable")]
    pub broker_addr_table: HashMap<String, BrokerData>,
    #[serde(rename = "clusterAddrTable")]
    pub cluster_addr_table: HashMap<String, Vec<String>>, // cluster -> broker names
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicListResponse {
    #[serde(rename = "topicList")]
    pub topic_list: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueData {
    #[serde(rename = "brokerName")]
    pub broker_name: String,
    #[serde(rename = "readQueueNums")]
    pub read_queue_nums: i32,
    #[serde(rename = "writeQueueNums")]
    pub write_queue_nums: i32,
    pub perm: i32,
    #[serde(rename = "topicSysFlag", default)]
    pub topic_syn_flag: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicRouteData {
    #[serde(rename = "queueDatas", default)]
    pub queue_datas: Vec<QueueData>,
    #[serde(rename = "brokerDatas", default)]
    pub broker_datas: Vec<BrokerData>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicQueueStatus {
    pub broker_name: String,
    pub broker_addr: String,
    pub queue_id: i32,
    pub min_offset: i64,
    pub max_offset: i64,
    pub message_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicStatus {
    pub topic: String,
    pub queues: Vec<TopicQueueStatus>,
    pub total_messages: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopicUpdateResult {
    pub updated_brokers: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageResult {
    pub msg_id: String,
    pub queue_id: i32,
    pub queue_offset: i64,
    pub broker_name: String,
    pub broker_addr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageExt {
    #[serde(default)]
    pub topic: Option<String>,
    #[serde(default)]
    pub flag: Option<i32>,
    #[serde(default)]
    pub properties: Option<HashMap<String, String>>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(rename = "queueId", default)]
    pub queue_id: Option<i32>,
    #[serde(rename = "queueOffset", default)]
    pub queue_offset: Option<i64>,
    #[serde(rename = "commitLogOffset", default)]
    pub commit_log_offset: Option<i64>,
    #[serde(rename = "sysFlag", default)]
    pub sys_flag: Option<i32>,
    #[serde(rename = "bornTimestamp", default)]
    pub born_timestamp: Option<i64>,
    #[serde(rename = "bornHost", default)]
    pub born_host: Option<String>,
    #[serde(rename = "storeTimestamp", default)]
    pub store_timestamp: Option<i64>,
    #[serde(rename = "storeHost", default)]
    pub store_host: Option<String>,
    #[serde(rename = "msgId", default)]
    pub msg_id: Option<String>,
    #[serde(rename = "reconsumeTimes", default)]
    pub reconsume_times: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionGroupListResponse {
    #[serde(rename = "subscriptionGroupTable", default)]
    pub subscription_group_table: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    #[serde(default)]
    pub client_id: String,
    #[serde(default)]
    pub client_addr: String,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub version: i32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsumerConnection {
    #[serde(default)]
    pub connection_set: Vec<ConnectionInfo>,
    #[serde(default)]
    pub subscription_table: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub consume_type: Option<String>,
    #[serde(default)]
    pub message_model: Option<String>,
    #[serde(default)]
    pub consume_from_where: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProducerConnection {
    #[serde(default)]
    pub connection_set: Vec<ConnectionInfo>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProducerTableInfo {
    #[serde(default)]
    pub data: HashMap<String, Vec<ProducerInfo>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProducerInfo {
    #[serde(default)]
    pub client_id: String,
    #[serde(default)]
    pub remote_ip: String,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub version: i32,
    #[serde(default)]
    pub last_update_timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceNode {
    pub title: String,
    pub timestamp: i64,
    pub status: String,
    pub cost_time: i64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsumerStatus {
    pub group: String,
    pub delivery_status: String,
    pub consume_time: i64,
    pub retry_count: i32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceRecord {
    #[serde(default)]
    pub nodes: Vec<TraceNode>,
    #[serde(default)]
    pub consumer_status: Vec<ConsumerStatus>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserInfo {
    #[serde(default)]
    pub username: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(rename = "userType", default, skip_serializing_if = "Option::is_none")]
    pub user_type: Option<String>,
    #[serde(rename = "userStatus", default, skip_serializing_if = "Option::is_none")]
    pub user_status: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AclInfo {
    #[serde(default)]
    pub subject: String,
    #[serde(default)]
    pub policies: Vec<PolicyInfo>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PolicyInfo {
    #[serde(rename = "policyType", default, skip_serializing_if = "Option::is_none")]
    pub policy_type: Option<String>,
    #[serde(default)]
    pub entries: Vec<PolicyEntryInfo>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PolicyEntryInfo {
    #[serde(default)]
    pub resource: String,
    #[serde(default)]
    pub actions: Vec<String>,
    #[serde(rename = "sourceIps", default)]
    pub source_ips: Vec<String>,
    #[serde(default)]
    pub decision: String,
}
