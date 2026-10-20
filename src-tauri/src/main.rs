// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod rocketmq;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::connect_cluster,
            commands::disconnect_cluster,
            commands::get_cluster_info,
            commands::get_topic_list,
            commands::get_consumer_groups,
            commands::get_consumer_progress,
            commands::get_consumer_connections,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
