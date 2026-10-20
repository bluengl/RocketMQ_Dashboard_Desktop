use crate::rocketmq;
use crate::rocketmq::protocol::{MessageExt, TraceRecord};

#[tauri::command]
pub async fn query_message_by_id(msg_id: String) -> Result<Vec<MessageExt>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.query_message_by_id(&msg_id)
}

#[tauri::command]
pub async fn query_message_by_key(topic: String, key: String) -> Result<Vec<MessageExt>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.query_message_by_key(&topic, &key)
}

#[tauri::command]
pub async fn query_message_by_time(
    topic: String,
    begin_ts: i64,
    end_ts: i64,
) -> Result<Vec<MessageExt>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.query_message_by_time(&topic, begin_ts, end_ts)
}

#[tauri::command]
pub async fn query_message_trace(
    msg_id: String,
    trace_topic: Option<String>,
) -> Result<TraceRecord, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.query_message_trace(&msg_id, trace_topic.as_deref())
}

#[tauri::command]
pub async fn query_message_trace_by_key(
    key: String,
    trace_topic: Option<String>,
) -> Result<TraceRecord, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.query_message_trace_by_key(&key, trace_topic.as_deref())
}
