// Topics created by RocketMQ itself; they are rarely relevant when picking a
// business topic manually.
const SYSTEM_TOPICS = new Set([
  'SELF_TEST_TOPIC',
  'BenchmarkTest',
  'OFFSET_MOVED_EVENT',
  'DefaultCluster',
])

const SYSTEM_PREFIXES = [
  'TBW102',
  '%RETRY%',
  '%DLQ%',
  'rmq_sys_',
  'RMQ_SYS_',
  'SCHEDULE_TOPIC_',
  'DefaultCluster_',
]

export function isSystemTopic(topic: string): boolean {
  return SYSTEM_TOPICS.has(topic) || SYSTEM_PREFIXES.some((prefix) => topic.startsWith(prefix))
}

export function filterUserTopics(topics: string[]): string[] {
  return topics.filter((topic) => !isSystemTopic(topic))
}
