// 与 Rust 后端 serde 默认序列化（snake_case）保持一致的类型定义

export interface ConnectionConfig {
  name_server_addrs: string[]
  acl_enabled: boolean
  access_key?: string | null
  secret_key?: string | null
}

export interface BrokerInfo {
  broker_name: string
  cluster_name: string
  broker_addrs: string[]
  version: string
  online: boolean
}

export interface ClusterInfo {
  brokers: BrokerInfo[]
  total_topics: number
  total_groups: number
}
