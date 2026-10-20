use crate::rocketmq;

#[tauri::command]
pub async fn get_topic_list() -> Result<Vec<String>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    match &*global {
        Some(client) => client.get_topic_list(),
        None => Err("Not connected to RocketMQ cluster".to_string()),
    }
}
