import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Language = 'en' | 'zh-CN'

type TranslationParams = Record<string, string | number>
export type Translator = (key: string, params?: TranslationParams) => string

const zhCN: Record<string, string> = {
  Dashboard: '仪表盘', Topics: '主题', Consumers: '消费者', Producers: '生产者',
  Messages: '消息查询', Cluster: '集群', ACL: '访问控制', Trace: '消息轨迹', OPS: '运维管理',
  'Management Console': 'RocketMQ 管理控制台', WORKSPACE: '工作区',
  'Primary navigation': '主导航',
  'ROCKETMQ REMOTING · LOCAL': 'ROCKETMQ 协议 · 本地连接', Connected: '已连接',
  Connection: '连接', Protocol: '协议', Data: '数据', Error: '错误',
  Disconnected: '未连接', 'Not connected': '未连接', 'No active cluster': '暂无活动集群',
  Connect: '连接', Disconnect: '断开连接', 'Connecting...': '正在连接…', 'Disconnecting...': '正在断开…',
  'NameServer Address': 'NameServer 地址', 'Access Key': '访问密钥', 'Secret Key': '私有密钥',
  'Require ACL credentials': '使用 ACL 凭据', 'Requests are signed with HMAC-SHA1': '请求使用 HMAC-SHA1 签名',
  'Dark blue theme': '暗蓝主题', 'Light gray theme': '灰白主题', Language: '语言', Theme: '主题',
  Refresh: '刷新', Brokers: 'Broker 节点', Broker: 'Broker', 'Consumer groups': '消费者组',
  Address: '地址', Version: '版本', Uptime: '运行时长', Status: '状态', Online: '在线', Offline: '离线', Unavailable: '不可用',
  total: '总计', online: '在线', 'Produce TPS': '生产 TPS', 'Consume TPS': '消费 TPS', 'msg/s': '条/秒',
  'Cluster overview and live message throughput': '集群概览与实时消息吞吐',
  'Connect to RocketMQ to view live metrics': '连接 RocketMQ 以查看实时指标',
  'Live metrics from broker runtime info': '来自 Broker 运行信息的实时指标',
  'sampled every {seconds}s': '每 {seconds} 秒采样', 'last sample {time}': '最近采样 {time}',
  'Message throughput': '消息吞吐', 'Last {count} samples': '最近 {count} 次采样',
  'Collecting samples…': '正在采集数据…', 'Chart view': '图表视图', 'Table view': '表格视图', Time: '时间',
  'No samples yet': '暂无采样数据', 'Waiting for the next sample to draw the trend…': '等待下一次采样以绘制趋势…',
  'No broker metrics available': '暂无 Broker 指标',
  'Search topics...': '搜索主题…', 'user topics': '个用户主题', 'Create Topic': '创建主题',
  'Topic Name': '主题名称', 'Read Queues': '读队列数', 'Write Queues': '写队列数', Permission: '权限',
  'Delete topic "{topic}"?': '确定删除主题“{topic}”吗？', READ_WRITE: '读写', READ: '读取', WRITE: '写入', INHERIT: '继承', NONE: '无权限',
  'Please connect to RocketMQ to view topics': '请先连接 RocketMQ 以查看主题', 'Loading topics...': '正在加载主题…',
  'Topic Route': '主题路由', 'Select a topic to view its route': '选择主题以查看路由', 'View route': '查看路由',
  'Topic Detail': '主题详情', Route: '路由', 'View status': '查看状态', 'Edit topic': '编辑主题',
  'Send test message': '发送测试消息', 'Messages in topic': '主题消息数', 'Min Offset': '最小位点',
  'Max Offset': '最大位点', 'Message Count': '消息数', 'No queue status available': '暂无队列状态',
  'Select a topic to view its details': '选择主题以查看详情', 'Select a topic to view its status': '选择主题以查看状态',
  'Edit Topic': '编辑主题', 'Target Broker': '目标 Broker', 'All master brokers': '所有主 Broker',
  'Queue counts and permission are applied to the selected brokers.': '队列数与权限将应用到选中的 Broker。',
  'Updating...': '正在更新…', 'Topic configuration updated on {count} broker(s)': '已在 {count} 个 Broker 上更新主题配置',  'Updated {count} broker(s), but some failed: {errors}': '已更新 {count} 个 Broker，但部分失败：{errors}',
  'Send Test Message': '发送测试消息', 'Broker (optional)': 'Broker（可选）', 'First available': '第一个可用 Broker',
  'Queue ID (optional)': '队列 ID（可选）', Auto: '自动', 'Tag (optional)': '标签（可选）', 'Key (optional)': 'Key（可选）',
  'Message Body': '消息体', 'Enter the message content...': '输入消息内容…', 'Message body is required': '消息体不能为空',
  'Queue ID must be a non-negative integer': '队列 ID 必须是非负整数', 'Message sent': '消息已发送',
  'Sending...': '正在发送…', Send: '发送',
  Actions: '操作', 'Delete topic': '删除主题', Cancel: '取消', Create: '创建', 'Creating...': '正在创建…',
  'Search consumer groups...': '搜索消费者组…',
  'Please connect to RocketMQ to view consumer groups': '请先连接 RocketMQ 以查看消费者组',
  'Loading consumer groups...': '正在加载消费者组…', 'No groups match your search': '没有匹配的分组',
  'No consumer groups found': '未找到消费者组', 'consumer group': '个消费者组', 'consumer groups': '个消费者组',
  'Groups ({count})': '分组（{count}）', 'Select a consumer group to view its progress and connections': '选择消费者组以查看消费进度和连接',
  'Loading...': '正在加载…', 'Reset Offset': '重置位点', 'Reset Consumer Offset': '重置消费者位点',
  'Consumer group': '消费者组',
  'Consume Type:': '消费类型：', 'Message Model:': '消息模式：', 'From Where:': '消费起点：',
  'This consumer group is not online. Select a topic below to inspect its committed offsets.': '该消费者组当前不在线。选择下方主题可检查已提交的位点。',
  'Online Instances': '在线实例', Queues: '队列数', 'Total Lag': '总堆积', 'max {value}': '最大值 {value}',
  'Consume Progress': '消费进度', 'Select a topic...': '选择主题…', 'Refresh progress': '刷新消费进度',
  'Loading progress...': '正在加载消费进度…', 'No progress data for this topic': '该主题暂无消费进度数据',
  'Select a topic to view consume progress': '选择主题以查看消费进度', Queue: '队列', 'Broker Offset': 'Broker 位点',
  'Consumer Offset': '消费者位点', Lag: '堆积量', 'Online Connections': '在线连接', 'Client ID': '客户端 ID',
  'No online clients': '没有在线客户端', 'Loading connections...': '正在加载连接…',
  'This page failed to render': '页面渲染失败', Retry: '重试',
  Topic: '主题', 'All queues': '所有队列', 'Queue {id}': '队列 {id}', 'Reset To': '重置到',
  read: '读', write: '写',
  'Latest offset (max)': '最新位点（最大值）', 'Earliest offset (min)': '最早位点（最小值）',
  'Custom offset': '指定位点', Offset: '位点', 'Please enter an offset value': '请输入位点值',
  'This changes the committed offsets for the consumer group and cannot be undone.': '此操作会修改消费者组已提交的位点，且无法撤销。',
  'Resetting...': '正在重置…', Reset: '重置', 'Search producer groups...': '搜索生产者组…',
  'Reset {count} queue(s) to {type}': '已将 {count} 个队列重置到{type}', max: '最新位点', min: '最早位点', offset: '指定位置',
  'Please connect to RocketMQ to view producers': '请先连接 RocketMQ 以查看生产者',
  'Loading producer groups...': '正在加载生产者组…', 'No producer groups found': '未找到生产者组',
  'Select a producer group to view its online clients': '选择生产者组以查看在线客户端',
  'producer group': '个生产者组', 'producer groups': '个生产者组',
  'Optional topic (limits brokers queried)': '可选主题（缩小 Broker 查询范围）', 'Reload connections': '重新加载连接',
  Scope: '查询范围', 'all master brokers': '所有主 Broker', 'No online producer clients for this group': '该生产者组没有在线客户端',
  'Query messages by ID or Topic + Key': '按消息 ID 或主题与 Key 查询消息',
  'Query by Message ID': '按消息 ID 查询', 'Query by Topic + Key': '按主题与 Key 查询', 'Query by Time Range': '按时间范围查询',
  'Message ID': '消息 ID', 'Message ID (32 hex chars)': '消息 ID（32 位十六进制）', 'Message key': '消息 Key',
  'Message Key': '消息 Key', Search: '查询', 'Please connect to RocketMQ to query messages': '请先连接 RocketMQ 以查询消息',
  'Querying messages...': '正在查询消息…', 'No messages found': '未找到消息',
  'Enter a Message ID, or a Topic + Key, to search': '输入消息 ID 或主题与 Key 开始查询',
  message: '条消息', messages: '条消息', 'Message Detail': '消息详情', 'View Trace': '查看轨迹',
  'Msg ID': '消息 ID', 'Queue Offset': '队列位点', 'Born Timestamp': '产生时间', 'Store Timestamp': '存储时间',
  'Born Host': '产生主机', 'Store Host': '存储主机', 'Reconsume Times': '重试次数', Tags: '标签', Keys: '键', Body: '消息体',
  '(empty body)': '（空消息体）', 'Select a message to view details': '选择消息以查看详情', 'N/A': '不可用',
  'Message Trace': '消息轨迹', 'Query the produce / store / consume chain by message ID or key': '按消息 ID 或 Key 查询生产、存储与消费链路',
  Key: 'Key', 'Trace topic (default RMQ_SYS_TRACE_TOPIC)': '轨迹主题（默认 RMQ_SYS_TRACE_TOPIC）',
  'Please connect to RocketMQ to query traces': '请先连接 RocketMQ 以查询消息轨迹', 'Loading trace...': '正在加载轨迹…',
  'Enter a message ID or key to view its trace chain': '输入消息 ID 或 Key 以查看轨迹链路',
  'No trace data found. Ensure message trace is enabled on the broker (traceTopicEnable=true).': '未找到轨迹数据。请确认 Broker 已启用消息轨迹（traceTopicEnable=true）。',
  'Trace Timeline': '轨迹时间线', 'node(s)': '个节点', 'No produce / consume nodes in the trace': '轨迹中没有生产或消费节点',
  'Consumer Status': '消费者状态', 'No consumer records': '没有消费者记录', Success: '成功', Failed: '失败', Pending: '等待中',
  Produce: '生产', Consume: '消费', Finished: '已完成', success: '成功', failed: '失败', finish: '已完成', pending: '等待中',
  'Retry count: {count}': '重试次数：{count}', 'Broker topology and runtime information': 'Broker 拓扑与运行信息',
  'Connect to RocketMQ to inspect the cluster': '连接 RocketMQ 以查看集群信息', 'Loading cluster topology…': '正在加载集群拓扑…',
  Topology: '拓扑结构', 'Cluster → broker → addresses': '集群 → Broker → 地址', 'No brokers reported by the name server': 'NameServer 未返回 Broker 信息',
  brokers: '个 Broker', 'addr {index}': '地址 {index}', master: '主节点', slave: '从节点', 'View runtime info': '查看运行信息',
  'Runtime info': '运行信息', 'Loading runtime info…': '正在加载运行信息…', 'Messages in today': '今日写入消息',
  'Messages out today': '今日读取消息', 'CommitLog capacity': 'CommitLog 容量', 'Put latency': '写入延迟',
  'Filter runtime keys and values…': '筛选运行信息的键和值…', Value: '值', 'No matching entries': '没有匹配项',
  'No runtime info available': '没有可用的运行信息', Close: '关闭',
  'ACL Management': 'ACL 管理', users: '个用户', rules: '条规则', 'Create User': '创建用户', 'Create Rule': '创建规则',
  'username': '用户名', 'topic:myTopic / group:myGroup / *': 'topic:主题名 / group:消费组 / *',
  '192.168.1.0/24, 10.0.0.1': '192.168.1.0/24, 10.0.0.1',
  Users: '用户', 'ACL Rules': 'ACL 规则', 'Please connect to RocketMQ to manage ACL': '请先连接 RocketMQ 以管理 ACL',
  'Loading ACL configuration...': '正在加载 ACL 配置…', 'Some brokers returned errors': '部分 Broker 返回错误',
  Username: '用户名', Password: '密码', Type: '类型', 'No ACL users found. ACL (authentication) may not be enabled on the broker.': '未找到 ACL 用户。Broker 可能未启用 ACL（认证）。',
  'Show password': '显示密码', 'Hide password': '隐藏密码', 'Edit user': '编辑用户', 'Delete user': '删除用户',
  'No ACL rules found. ACL (authorization) may not be enabled on the broker.': '未找到 ACL 规则。Broker 可能未启用 ACL（授权）。',
  Subject: '主体', Resource: '资源', 'Source IPs': '来源 IP', Decision: '决策', 'Edit rule': '编辑规则', 'Delete rule': '删除规则',
  'Edit ACL User': '编辑 ACL 用户', 'Create ACL User': '创建 ACL 用户', 'Edit ACL Rule': '编辑 ACL 规则', 'Create ACL Rule': '创建 ACL 规则',
  'User Type': '用户类型', 'Changes are applied to every master broker in the cluster.': '变更将应用到集群中的所有主 Broker。',
  'Filter topics...': '筛选主题…', 'No matching topics': '没有匹配的主题', 'Rows per page': '每页条数', 'Offset type': '位点类型',
  'Start time': '开始时间', 'End time': '结束时间', Hours: '小时', Minutes: '分钟', Clear: '清除', Now: '现在', Done: '完成',
  'Message Key (optional)': '消息 Key（可选，留空则列出最近 24 小时消息）',
  'Trace topic': '轨迹主题',
  'By samples': '按次数', 'By time': '按时间范围', Last: '最近', Samples: '采样次数', samples: '个采样点', 'Until now': '到当前',
  'Previous month': '上个月', 'Next month': '下个月',
  'optional, comma separated': '可选，使用逗号分隔', Normal: '普通用户', Super: '超级用户', enable: '启用', disable: '禁用',
  Allow: '允许', Deny: '拒绝', Pub: '发布', Sub: '订阅', Any: '任意', Update: '更新', Get: '获取', List: '列出',
  'Username is required': '用户名不能为空', 'Password is required': '密码不能为空', 'Subject is required': '主体不能为空',
  'Resource is required': '资源不能为空', 'Select at least one action': '至少选择一个操作',
  'Delete ACL user "{username}" from all brokers?': '确定从所有 Broker 删除 ACL 用户“{username}”吗？',
  'Delete ACL rule "{subject} → {resource}"?': '确定删除 ACL 规则“{subject} → {resource}”吗？',
  'NameServer profiles and multi-cluster switching': 'NameServer 配置与多集群切换', 'Select a cluster profile to connect': '选择集群配置以连接',
  'Active profile:': '当前配置：', 'Add Cluster': '添加集群', 'Cluster Profiles': '集群配置',
  'No saved clusters. Add a NameServer profile to switch between clusters quickly.': '没有已保存的集群。添加 NameServer 配置以快速切换集群。',
  Name: '名称', NameServer: 'NameServer', 'active connection': '当前连接', 'Edit profile': '编辑配置', 'Delete profile': '删除配置',
  enabled: '已启用',
  'Edit Cluster Profile': '编辑集群配置', 'Add Cluster Profile': '添加集群配置', 'Display Name': '显示名称',
  'e.g. production': '例如：生产集群',
  'NameServer address is required': 'NameServer 地址不能为空', 'Connection to {address} failed': '连接 {address} 失败',
  'Connection to {address} failed: {error}': '连接 {address} 失败：{error}',
  'Delete cluster profile "{name}"?': '确定删除集群配置“{name}”吗？', Save: '保存', 'Saving...': '正在保存…',
  'Page {page} of {totalPages}': '第 {page} / {totalPages} 页', items: '项', item: '项',
  'per page': '条/页', 'Previous page': '上一页', 'Next page': '下一页',
}

function translate(language: Language, key: string, params?: TranslationParams) {
  let value = language === 'zh-CN' ? (zhCN[key] ?? key) : key
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.split(`{${name}}`).join(String(replacement))
    }
  }
  return value
}

interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  t: Translator
}

export const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem('rocketmq.language') === 'zh-CN' ? 'zh-CN' : 'en'
    } catch {
      return 'en'
    }
  })

  const setLanguage = (next: Language) => {
    setLanguageState(next)
    try {
      localStorage.setItem('rocketmq.language', next)
    } catch {
      // Preferences remain available for the current session when storage is disabled.
    }
  }

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (key, params) => translate(language, key, params) }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
