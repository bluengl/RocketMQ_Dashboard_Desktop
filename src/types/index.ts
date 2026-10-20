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

export interface MessageInfo {
  topic?: string
  flag?: number
  properties?: Record<string, string>
  body?: string
  queueId?: number
  queueOffset?: number
  commitLogOffset?: number
  sysFlag?: number
  bornTimestamp?: number
  bornHost?: string
  storeTimestamp?: number
  storeHost?: string
  msgId?: string
  reconsumeTimes?: number
}

export interface QueueData {
  brokerName: string
  readQueueNums: number
  writeQueueNums: number
  perm: number
  topicSynFlag: number
}

export interface TopicBrokerData {
  cluster: string
  brokerName: string
  brokerAddrs: Record<string, string>
}

export interface TopicRouteData {
  queueDatas: QueueData[]
  brokerDatas: TopicBrokerData[]
}
