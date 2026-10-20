use crate::rocketmq;
use crate::rocketmq::protocol::ConsumerConnection;
use crate::rocketmq::ConsumerProgress;

/// List all consumer groups configured on the cluster's brokers
#[tauri::command]
pub async fn get_consumer_groups() -> Result<Vec<String>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.get_consumer_groups()
}

/// Get online client connections of a consumer group (None when the group is offline)
#[tauri::command]
pub async fn get_consumer_connections(
    group: String,
) -> Result<Option<ConsumerConnection>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.get_consumer_connections(&group)
}

/// Get per-queue consume progress; topic defaults to all subscriptions of an online group
#[tauri::command]
pub async fn get_consumer_progress(
    group: String,
    topic: Option<String>,
) -> Result<Vec<ConsumerProgress>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.get_consumer_progress(&group, topic.as_deref())
}

/// Reset consumer offsets; offset_type is "max", "min" or "offset"
#[tauri::command]
pub async fn reset_consumer_offset(
    group: String,
    topic: String,
    queue_id: Option<i32>,
    offset_type: String,
    offset: Option<i64>,
) -> Result<usize, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.reset_consumer_offset(&group, &topic, queue_id, &offset_type, offset)
}
