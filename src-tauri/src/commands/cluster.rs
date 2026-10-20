// src-tauri/src/commands/cluster.rs
use crate::rocketmq::{self, ConnectionConfig, ClusterInfo};

#[tauri::command]
pub async fn connect_cluster(config: ConnectionConfig) -> Result<(), String> {
    rocketmq::connect(config).await
}

#[tauri::command]
pub async fn disconnect_cluster() -> Result<(), String> {
    rocketmq::disconnect().await;
    Ok(())
}

#[tauri::command]
pub async fn get_cluster_info() -> Result<ClusterInfo, String> {
    rocketmq::get_cluster_info().await
}
