use crate::rocketmq;
use crate::rocketmq::protocol::MessageExt;

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
