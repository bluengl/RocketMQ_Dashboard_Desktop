use crate::rocketmq;
use crate::rocketmq::protocol::TopicRouteData;

#[tauri::command]
pub async fn get_topic_list() -> Result<Vec<String>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    match &*global {
        Some(client) => client.get_topic_list(),
        None => Err("Not connected to RocketMQ cluster".to_string()),
    }
}

#[tauri::command]
pub async fn get_topic_route(topic: String) -> Result<TopicRouteData, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.get_route_info_by_topic(&topic)
}

#[tauri::command]
pub async fn create_topic(
    topic: String,
    broker_addr: Option<String>,
    read_queue_nums: i32,
    write_queue_nums: i32,
    perm: i32,
) -> Result<(), String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;

    let addr = match broker_addr {
        Some(a) => a,
        None => {
            let cluster = client.get_cluster_info()?;
            let broker = cluster.brokers.first().ok_or("No broker available")?;
            broker.broker_addrs.first().cloned().ok_or("No broker address")?
        }
    };

    client.create_topic(&topic, &addr, read_queue_nums, write_queue_nums, perm)
}

#[tauri::command]
pub async fn delete_topic(topic: String) -> Result<(), String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.delete_topic(&topic)
}
