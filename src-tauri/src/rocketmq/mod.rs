pub mod client;
pub mod protocol;

pub use client::{ClusterInfo, ConnectionConfig, ConsumerProgress, RocketMQClient};
use std::sync::Arc;
use tokio::sync::Mutex;

// Global client instance
pub static GLOBAL_CLIENT: Mutex<Option<Arc<RocketMQClient>>> = Mutex::const_new(None);

pub async fn connect(config: ConnectionConfig) -> Result<(), String> {
    let client = RocketMQClient::new(config)?;
    
    // Test connection before saving
    client.test_connection()?;
    
    let mut global = GLOBAL_CLIENT.lock().await;
    *global = Some(Arc::new(client));
    Ok(())
}

pub async fn disconnect() {
    let mut global = GLOBAL_CLIENT.lock().await;
    *global = None;
}

pub async fn get_cluster_info() -> Result<ClusterInfo, String> {
    let global = GLOBAL_CLIENT.lock().await;
    match &*global {
        Some(client) => client.get_cluster_info(),
        None => Err("Not connected to RocketMQ cluster".to_string()),
    }
}
