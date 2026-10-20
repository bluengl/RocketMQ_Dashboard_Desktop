use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// RocketMQ Request Codes
pub const GET_BROKER_CLUSTER_INFO: i32 = 106;
pub const GET_ALL_TOPIC_LIST_FROM_NAMESERVER: i32 = 206;
pub const GET_ROUTEINFO_BY_TOPIC: i32 = 105;
pub const QUERY_MESSAGE: i32 = 12;
pub const VIEW_MESSAGE_BY_ID: i32 = 33;
pub const SEARCH_OFFSET_BY_TIMESTAMP: i32 = 29;
pub const UPDATE_AND_CREATE_TOPIC: i32 = 17;
pub const DELETE_TOPIC_IN_NAMESRV: i32 = 216;
pub const DELETE_TOPIC_IN_BROKER: i32 = 215;

// Response Codes
pub const SUCCESS: i32 = 0;

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

    pub fn encode(&self) -> Result<Vec<u8>, String> {
        let header_json = serde_json::to_string(self)
            .map_err(|e| format!("Serialize header failed: {}", e))?;
        let header_bytes = header_json.as_bytes();
        
        // Protocol format:
        // 4 bytes: total length (header length marker + header)
        // 4 bytes: header length (with serialization type in high byte)
        // N bytes: header JSON
        // M bytes: body (empty for most requests)
        
        let header_len = header_bytes.len() as i32;
        let total_len = 4 + header_len; // 4 for header length marker
        
        let mut buffer = Vec::new();
        
        // Total length (big endian)
        buffer.extend_from_slice(&total_len.to_be_bytes());
        
        // Header length with serialization type (0 = JSON in high byte)
        let header_len_with_type = header_len | (0 << 24);
        buffer.extend_from_slice(&header_len_with_type.to_be_bytes());
        
        // Header
        buffer.extend_from_slice(header_bytes);
        
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
    pub broker_addrs: HashMap<String, String>, // "0" -> "ip:port" (0=master, 1+=slave)
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
    #[serde(rename = "topicSynFlag")]
    pub topic_syn_flag: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicRouteData {
    #[serde(rename = "queueDatas", default)]
    pub queue_datas: Vec<QueueData>,
    #[serde(rename = "brokerDatas", default)]
    pub broker_datas: Vec<BrokerData>,
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
