use crate::rocketmq;
use crate::rocketmq::protocol::ConnectionInfo;

/// List producer groups registered on the cluster's brokers
#[tauri::command]
pub async fn get_producer_groups() -> Result<Vec<String>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.get_producer_groups()
}

/// Get online producer clients for a group, optionally scoped to brokers hosting a topic
#[tauri::command]
pub async fn get_producer_connections(
    group: String,
    topic: Option<String>,
) -> Result<Vec<ConnectionInfo>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.get_producer_connections(&group, topic.as_deref())
}
