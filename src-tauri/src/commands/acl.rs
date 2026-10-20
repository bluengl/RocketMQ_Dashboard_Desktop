use crate::rocketmq;
use crate::rocketmq::client::{BrokerAclRules, BrokerAclUsers};
use crate::rocketmq::protocol::{AclInfo, PolicyEntryInfo, PolicyInfo, UserInfo};

#[tauri::command]
pub async fn list_acl_users(filter: Option<String>) -> Result<Vec<BrokerAclUsers>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.list_acl_users(filter.as_deref().unwrap_or(""))
}

#[tauri::command]
pub async fn create_acl_user(
    username: String,
    password: String,
    user_type: Option<String>,
) -> Result<(), String> {
    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }
    if password.trim().is_empty() {
        return Err("Password is required".to_string());
    }

    let user = UserInfo {
        username: username.trim().to_string(),
        password: Some(password),
        user_type: Some(user_type.unwrap_or_else(|| "Normal".to_string())),
        user_status: Some("enable".to_string()),
    };

    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.create_acl_user(&user)
}

#[tauri::command]
pub async fn update_acl_user(
    username: String,
    password: Option<String>,
    user_type: Option<String>,
    user_status: Option<String>,
) -> Result<(), String> {
    if username.trim().is_empty() {
        return Err("Username is required".to_string());
    }

    let user = UserInfo {
        username: username.trim().to_string(),
        password,
        user_type,
        user_status,
    };

    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.update_acl_user(&user)
}

#[tauri::command]
pub async fn delete_acl_user(username: String) -> Result<(), String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.delete_acl_user(&username)
}

#[tauri::command]
pub async fn list_acl_rules(
    subject: Option<String>,
    resource: Option<String>,
) -> Result<Vec<BrokerAclRules>, String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.list_acl_rules(
        subject.as_deref().unwrap_or(""),
        resource.as_deref().unwrap_or(""),
    )
}

fn build_acl(
    subject: String,
    resources: Vec<String>,
    actions: Vec<String>,
    source_ips: Vec<String>,
    decision: String,
) -> Result<AclInfo, String> {
    if subject.trim().is_empty() {
        return Err("Subject is required".to_string());
    }

    let resources: Vec<String> = resources
        .into_iter()
        .map(|resource| resource.trim().to_string())
        .filter(|resource| !resource.is_empty())
        .collect();
    if resources.is_empty() {
        return Err("At least one resource is required".to_string());
    }

    let actions: Vec<String> = actions
        .into_iter()
        .map(|action| action.trim().to_string())
        .filter(|action| !action.is_empty())
        .collect();
    if actions.is_empty() {
        return Err("At least one action is required".to_string());
    }

    let entries = resources
        .into_iter()
        .map(|resource| PolicyEntryInfo {
            resource,
            actions: actions.clone(),
            source_ips: source_ips
                .iter()
                .map(|ip| ip.trim().to_string())
                .filter(|ip| !ip.is_empty())
                .collect(),
            decision: decision.clone(),
        })
        .collect();

    Ok(AclInfo {
        subject: subject.trim().to_string(),
        policies: vec![PolicyInfo {
            policy_type: Some("Custom".to_string()),
            entries,
        }],
    })
}

#[tauri::command]
pub async fn create_acl_rule(
    subject: String,
    resources: Vec<String>,
    actions: Vec<String>,
    source_ips: Vec<String>,
    decision: String,
) -> Result<(), String> {
    let acl = build_acl(subject, resources, actions, source_ips, decision)?;

    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.create_acl_rule(&acl)
}

#[tauri::command]
pub async fn update_acl_rule(
    subject: String,
    resources: Vec<String>,
    actions: Vec<String>,
    source_ips: Vec<String>,
    decision: String,
) -> Result<(), String> {
    let acl = build_acl(subject, resources, actions, source_ips, decision)?;

    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.update_acl_rule(&acl)
}

#[tauri::command]
pub async fn delete_acl_rule(subject: String, resource: String) -> Result<(), String> {
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.delete_acl_rule(&subject, &resource)
}
