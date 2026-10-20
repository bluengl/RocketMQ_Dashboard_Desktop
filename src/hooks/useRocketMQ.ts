import { invoke } from '@tauri-apps/api/core'
import type { ConnectionConfig, ClusterInfo } from '../types'

// 统一的前端 API 层：只暴露已注册的 Tauri 命令
export function useRocketMQ() {
  const connect = async (config: ConnectionConfig): Promise<void> => {
    await invoke('connect_cluster', { config })
  }

  const disconnect = async (): Promise<void> => {
    await invoke('disconnect_cluster')
  }

  const getClusterInfo = async (): Promise<ClusterInfo> => {
    return await invoke<ClusterInfo>('get_cluster_info')
  }

  const getTopicList = async (): Promise<string[]> => {
    return await invoke<string[]>('get_topic_list')
  }

  const getConsumerGroups = async (): Promise<string[]> => {
    return await invoke<string[]>('get_consumer_groups')
  }

  return {
    connect,
    disconnect,
    getClusterInfo,
    getTopicList,
    getConsumerGroups,
  }
}
