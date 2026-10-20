use std::collections::HashMap;

use crate::rocketmq;
use crate::rocketmq::client::DashboardMetrics;
use crate::rocketmq::RocketMQClient;
use std::sync::Arc;

async fn client() -> Result<Arc<RocketMQClient>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    global
        .as_ref()
        .cloned()
        .ok_or_else(|| "Not connected to RocketMQ".to_string())
}

#[tauri::command]
pub async fn get_dashboard_metrics() -> Result<DashboardMetrics, String> {
    client().await?.get_dashboard_metrics()
}

#[tauri::command]
pub async fn get_broker_runtime_info(
    broker_addr: String,
) -> Result<HashMap<String, String>, String> {
    client().await?.get_broker_runtime_info(&broker_addr)
}

#[tauri::command]
pub async fn get_broker_stats_data(
    broker_addr: String,
    stats_key: String,
    stats_name: String,
    stats_type: String,
) -> Result<serde_json::Value, String> {
    client()
        .await?
        .get_broker_stats_data(&broker_addr, &stats_key, &stats_name, &stats_type)
}

#[tauri::command]
pub async fn get_broker_consume_stats(
    broker_addr: String,
    group: Option<String>,
) -> Result<serde_json::Value, String> {
    client().await?.get_broker_consume_stats(&broker_addr, group.as_deref())
}
