use crate::rocketmq;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConsumerProgress {
    pub message_queue: String,
    pub broker_offset: i64,
    pub consumer_offset: i64,
    pub last_timestamp: i64,
    pub lag: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConsumerConnection {
    pub client_id: String,
    pub client_addr: String,
    pub language: String,
    pub version: String,
}

/// Get all consumer groups
#[tauri::command]
pub async fn get_consumer_groups() -> Result<Vec<String>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;

    // Request code: GET_ALL_CONSUMER_GROUP = 200
    let (response, body) = client
        .send_generic_request(200, HashMap::new())
        .map_err(|e| format!("Failed to get consumer groups: {}", e))?;

    if response.code != 0 {
        return Err(format!(
            "Failed to get consumer groups: code={}, remark={:?}",
            response.code, response.remark
        ));
    }

    if body.is_empty() {
        return Ok(Vec::new());
    }

    // Parse body as JSON object with groupList array
    let body_str = String::from_utf8(body)
        .map_err(|e| format!("Invalid UTF-8 response: {}", e))?;

    #[derive(Deserialize)]
    struct GroupListResponse {
        #[serde(rename = "groupList")]
        group_list: Option<Vec<String>>,
    }

    let response: GroupListResponse = serde_json::from_str(&body_str)
        .map_err(|e| format!("Failed to parse consumer groups: {}", e))?;

    Ok(response.group_list.unwrap_or_default())
}

/// Get consumer progress for a specific group
#[tauri::command]
pub async fn get_consumer_progress(
    group: String,
    topic: String,
) -> Result<Vec<ConsumerProgress>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;

    // Request code: QUERY_CONSUMER_OFFSET = 14
    let mut ext_fields = HashMap::new();
    ext_fields.insert("consumerGroup".to_string(), group);
    ext_fields.insert("topic".to_string(), topic);

    let (response, body) = client
        .send_generic_request(14, ext_fields)
        .map_err(|e| format!("Failed to get consumer progress: {}", e))?;

    if response.code != 0 {
        return Err(format!(
            "Failed to get consumer progress: code={}, remark={:?}",
            response.code, response.remark
        ));
    }

    if body.is_empty() {
        return Ok(Vec::new());
    }

    let body_str = String::from_utf8(body)
        .map_err(|e| format!("Invalid UTF-8 response: {}", e))?;

    let progress: Vec<ConsumerProgress> = serde_json::from_str(&body_str)
        .map_err(|e| format!("Failed to parse consumer progress: {}", e))?;

    Ok(progress)
}

/// Get consumer connections
#[tauri::command]
pub async fn get_consumer_connections(
    group: String,
) -> Result<Vec<ConsumerConnection>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;

    // Request code: GET_CONSUMER_CONNECTION_LIST = 204
    let mut ext_fields = HashMap::new();
    ext_fields.insert("consumerGroup".to_string(), group);

    let (response, body) = client
        .send_generic_request(204, ext_fields)
        .map_err(|e| format!("Failed to get consumer connections: {}", e))?;

    if response.code != 0 {
        return Err(format!(
            "Failed to get consumer connections: code={}, remark={:?}",
            response.code, response.remark
        ));
    }

    if body.is_empty() {
        return Ok(Vec::new());
    }

    let body_str = String::from_utf8(body)
        .map_err(|e| format!("Invalid UTF-8 response: {}", e))?;

    let connections: Vec<ConsumerConnection> = serde_json::from_str(&body_str)
        .map_err(|e| format!("Failed to parse consumer connections: {}", e))?;

    Ok(connections)
}
