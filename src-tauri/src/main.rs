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
            commands::get_topic_route,
            commands::create_topic,
            commands::delete_topic,
            commands::get_consumer_groups,
            commands::get_consumer_progress,
            commands::get_consumer_connections,
            commands::reset_consumer_offset,
            commands::query_message_by_id,
            commands::query_message_by_key,
            commands::query_message_by_time,
            commands::query_message_trace,
            commands::query_message_trace_by_key,
            commands::get_dashboard_metrics,
            commands::get_broker_runtime_info,
            commands::get_broker_stats_data,
            commands::get_broker_consume_stats,
            commands::list_acl_users,
            commands::create_acl_user,
            commands::update_acl_user,
            commands::delete_acl_user,
            commands::list_acl_rules,
            commands::create_acl_rule,
            commands::update_acl_rule,
            commands::delete_acl_rule,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
