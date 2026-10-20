export interface BrokerMetrics {
  brokerName: string
  cluster: string
  brokerAddr: string
  online: boolean
  version: string
  uptime: string
  putTps: number
  getTps: number
  msgPutToday: number
  msgGetToday: number
  error?: string | null
}

export interface DashboardMetrics {
  brokers: BrokerMetrics[]
  totalTopics: number
  totalGroups: number
  totalPutTps: number
  totalGetTps: number
  sampledAt: number
}

export interface TpsSample {
  time: number
  putTps: number
  getTps: number
}
