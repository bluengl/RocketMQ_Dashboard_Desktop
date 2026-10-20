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

export interface ConsumerConnectionInfo {
  clientId: string
  clientAddr: string
  language: string
  version: number
}

export interface ConsumerConnection {
  connectionSet: ConsumerConnectionInfo[]
  subscriptionTable: Record<string, unknown>
  consumeType?: string | null
  messageModel?: string | null
  consumeFromWhere?: string | null
}

export interface ConsumerProgress {
  topic: string
  brokerName: string
  queueId: number
  brokerOffset: number
  consumerOffset: number
  lag: number
}

export interface ProducerConnectionInfo {
  clientId: string
  clientAddr: string
  language: string
  version: number
}

export interface TraceNode {
  title: string
  timestamp: number
  status: 'finish' | 'failed' | string
  costTime: number
  description: string
}

export interface ConsumerStatus {
  group: string
  deliveryStatus: 'success' | 'failed' | 'pending' | string
  consumeTime: number
  retryCount: number
}

export interface TraceRecord {
  nodes: TraceNode[]
  consumerStatus: ConsumerStatus[]
}

export interface AclUserInfo {
  username: string
  password?: string | null
  userType?: string | null
  userStatus?: string | null
}

export interface PolicyEntryInfo {
  resource: string
  actions: string[]
  sourceIps: string[]
  decision: string
}

export interface PolicyInfo {
  policyType?: string | null
  entries: PolicyEntryInfo[]
}

export interface AclInfo {
  subject: string
  policies: PolicyInfo[]
}

export interface BrokerAclUsers {
  broker_addr: string
  users: AclUserInfo[]
  error?: string | null
}

export interface BrokerAclRules {
  broker_addr: string
  rules: AclInfo[]
  error?: string | null
}
