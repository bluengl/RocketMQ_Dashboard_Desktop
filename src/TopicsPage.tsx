import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  List,
  RefreshCw,
  Plus,
  Trash2,
  Search,
  Route,
  Pencil,
  Send,
  BarChart3,
  CheckCircle2,
} from 'lucide-react'
import type { SendMessageResult, TopicRouteData, TopicStatus } from './types'
import Pagination from './components/Pagination'
import ErrorNotice from './components/ErrorNotice'
import LoadingMask from './components/LoadingMask'
import Select from './components/Select'
import { filterUserTopics } from './utils/topics'
import { usePagination } from './hooks/usePagination'
import { useI18n } from './i18n'

interface TopicsPageProps {
  connected: boolean
}

// RocketMQ permission bits: 1 = INHERIT, 2 = WRITE, 4 = READ.
function formatPerm(perm: number): string {
  const parts: string[] = []
  if (perm & 4) parts.push('READ')
  if (perm & 2) parts.push('WRITE')
  if (parts.length === 0) parts.push('NONE')
  if (perm & 1) parts.push('INHERIT')
  return parts.join(' | ')
}

function masterBrokers(route: TopicRouteData | null) {
  if (!route) return []
  return route.brokerDatas
    .map((broker) => ({
      name: broker.brokerName,
      addr: broker.brokerAddrs['0'],
    }))
    .filter((broker): broker is { name: string; addr: string } => Boolean(broker.addr))
}

export default function TopicsPage({ connected }: TopicsPageProps) {
  const { t } = useI18n()
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [readQueueNums, setReadQueueNums] = useState(8)
  const [writeQueueNums, setWriteQueueNums] = useState(8)
  const [perm, setPerm] = useState(6)
  const [creating, setCreating] = useState(false)

  const [detailTab, setDetailTab] = useState<'route' | 'status'>('route')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [route, setRoute] = useState<TopicRouteData | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [status, setStatus] = useState<TopicStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const [editTopic, setEditTopic] = useState<string | null>(null)
  const [editRoute, setEditRoute] = useState<TopicRouteData | null>(null)
  const [editReadQueues, setEditReadQueues] = useState(8)
  const [editWriteQueues, setEditWriteQueues] = useState(8)
  const [editPerm, setEditPerm] = useState(6)
  const [editBrokerAddr, setEditBrokerAddr] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [updating, setUpdating] = useState(false)

  const [sendTopic, setSendTopic] = useState<string | null>(null)
  const [sendRoute, setSendRoute] = useState<TopicRouteData | null>(null)
  const [sendBody, setSendBody] = useState('')
  const [sendTag, setSendTag] = useState('')
  const [sendKey, setSendKey] = useState('')
  const [sendQueueId, setSendQueueId] = useState('')
  const [sendBroker, setSendBroker] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendMessageResult | null>(null)

  const loadTopics = async () => {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<string[]>('get_topic_list')
      setTopics(result)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const loadRoute = async (topic: string) => {
    setSelectedTopic(topic)
    setDetailTab('route')
    setRouteLoading(true)
    setError(null)
    try {
      const result = await invoke<TopicRouteData>('get_topic_route', { topic })
      setRoute(result)
    } catch (err) {
      setError(err as string)
      setRoute(null)
    } finally {
      setRouteLoading(false)
    }
  }

  const loadStatus = async (topic: string) => {
    setSelectedTopic(topic)
    setDetailTab('status')
    setStatusLoading(true)
    setStatus(null)
    setError(null)
    try {
      const result = await invoke<TopicStatus>('get_topic_status', { topic })
      setStatus(result)
    } catch (err) {
      setError(err as string)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newTopic.trim()) return
    setCreating(true)
    setError(null)
    setNotice(null)
    try {
      await invoke('create_topic', {
        topic: newTopic.trim(),
        brokerAddr: null,
        readQueueNums,
        writeQueueNums,
        perm,
      })
      setShowCreate(false)
      setNewTopic('')
      await loadTopics()
    } catch (err) {
      setError(err as string)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (topic: string) => {
    if (!window.confirm(t('Delete topic "{topic}"?', { topic }))) return
    setError(null)
    setNotice(null)
    try {
      await invoke('delete_topic', { topic })
      await loadTopics()
      if (selectedTopic === topic) {
        setSelectedTopic(null)
        setRoute(null)
        setStatus(null)
      }
    } catch (err) {
      setError(err as string)
    }
  }

  const openEdit = async (topic: string) => {
    setEditTopic(topic)
    setEditRoute(null)
    setEditBrokerAddr('')
    setEditReadQueues(8)
    setEditWriteQueues(8)
    setEditPerm(6)
    setEditLoading(true)
    setError(null)
    setNotice(null)
    try {
      const result = await invoke<TopicRouteData>('get_topic_route', { topic })
      setEditRoute(result)
      const first = result.queueDatas[0]
      if (first) {
        setEditReadQueues(first.readQueueNums)
        setEditWriteQueues(first.writeQueueNums)
        setEditPerm(first.perm)
      }
    } catch (err) {
      setError(err as string)
    } finally {
      setEditLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editTopic) return
    setUpdating(true)
    setError(null)
    setNotice(null)
    try {
      const result = await invoke<{ updatedBrokers: string[]; errors: string[] }>(
        'update_topic',
        {
          topic: editTopic,
          readQueueNums: editReadQueues,
          writeQueueNums: editWriteQueues,
          perm: editPerm,
          brokerAddr: editBrokerAddr || null,
        }
      )
      await loadTopics()
      if (selectedTopic === editTopic) {
        if (detailTab === 'status') {
          await loadStatus(editTopic)
        } else {
          await loadRoute(editTopic)
        }
      }
      if (result.errors.length > 0) {
        setError(t('Updated {count} broker(s), but some failed: {errors}', {
          count: result.updatedBrokers.length,
          errors: result.errors.join('; '),
        }))
      } else {
        setNotice(t('Topic configuration updated on {count} broker(s)', {
          count: result.updatedBrokers.length,
        }))
      }
      setEditTopic(null)
    } catch (err) {
      setError(err as string)
    } finally {
      setUpdating(false)
    }
  }

  const openSend = async (topic: string) => {
    setSendTopic(topic)
    setSendRoute(null)
    setSendBody('')
    setSendTag('')
    setSendKey('')
    setSendQueueId('')
    setSendBroker('')
    setSendResult(null)
    setSendLoading(true)
    setError(null)
    setNotice(null)
    try {
      const result = await invoke<TopicRouteData>('get_topic_route', { topic })
      setSendRoute(result)
    } catch (err) {
      setError(err as string)
    } finally {
      setSendLoading(false)
    }
  }

  const handleSend = async () => {
    if (!sendTopic) return
    if (!sendBody.trim()) {
      setError(t('Message body is required'))
      return
    }
    const parsedQueueId = sendQueueId.trim() === '' ? null : Number(sendQueueId)
    if (parsedQueueId !== null && (!Number.isInteger(parsedQueueId) || parsedQueueId < 0)) {
      setError(t('Queue ID must be a non-negative integer'))
      return
    }

    setSending(true)
    setError(null)
    setNotice(null)
    setSendResult(null)
    try {
      const result = await invoke<SendMessageResult>('send_test_message', {
        topic: sendTopic,
        body: sendBody,
        tag: sendTag.trim() || null,
        key: sendKey.trim() || null,
        queueId: parsedQueueId,
        brokerName: sendBroker || null,
      })
      setSendResult(result)
    } catch (err) {
      setError(err as string)
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (connected) {
      loadTopics()
    }
  }, [connected])

  useEffect(() => {
    if (!showCreate && !editTopic && !sendTopic) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCreate(false)
        setEditTopic(null)
        setSendTopic(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showCreate, editTopic, sendTopic])

  const filteredTopics = topics.filter((topic) =>
    topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const userTopics = filterUserTopics(filteredTopics)

  const topicsPager = usePagination(userTopics, 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <List className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">{t('Topics')}</h1>
            <p className="text-sm text-slate-400">{userTopics.length} {t('user topics')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadTopics}
            disabled={!connected || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('Refresh')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!connected}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {t('Create Topic')}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder={t('Search topics...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {error && <ErrorNotice error={error} />}
      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {notice}
        </div>
      )}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">{t('Please connect to RocketMQ to view topics')}</div>
      ) : (
        <div className="rmq-loading-wrap grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-sm">
                  <th className="text-left px-6 py-3 font-medium">{t('Topic Name')}</th>
                  <th className="text-right px-6 py-3 font-medium">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {topicsPager.pageItems.map((topic, index) => (
                  <tr key={index} className="hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => loadRoute(topic)}
                        className="font-medium text-slate-100 hover:text-cyan-300 transition-colors"
                      >
                        {topic}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => loadRoute(topic)}
                          className="p-2 hover:bg-cyan-500/10 rounded transition-colors text-slate-400 hover:text-cyan-300"
                          title={t('View route')}
                        >
                          <Route className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadStatus(topic)}
                          className="p-2 hover:bg-cyan-500/10 rounded transition-colors text-slate-400 hover:text-cyan-300"
                          title={t('View status')}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(topic)}
                          className="p-2 hover:bg-cyan-500/10 rounded transition-colors text-slate-400 hover:text-cyan-300"
                          title={t('Edit topic')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openSend(topic)}
                          className="p-2 hover:bg-cyan-500/10 rounded transition-colors text-slate-400 hover:text-cyan-300"
                          title={t('Send test message')}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(topic)}
                          className="p-2 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-400"
                          title={t('Delete topic')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={topicsPager.page}
              pageSize={topicsPager.pageSize}
              total={topicsPager.total}
              totalPages={topicsPager.totalPages}
              onPageChange={topicsPager.setPage}
              onPageSizeChange={topicsPager.setPageSize}
            />
          </div>

          {/* Detail panel */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-slate-200">{t('Topic Detail')}</div>
              <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                <button
                  onClick={() => selectedTopic && loadRoute(selectedTopic)}
                  disabled={!selectedTopic}
                  className={`px-2.5 py-1 rounded text-xs transition-colors disabled:opacity-40 ${
                    detailTab === 'route' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('Route')}
                </button>
                <button
                  onClick={() => selectedTopic && loadStatus(selectedTopic)}
                  disabled={!selectedTopic}
                  className={`px-2.5 py-1 rounded text-xs transition-colors disabled:opacity-40 ${
                    detailTab === 'status' ? 'bg-slate-700 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t('Status')}
                </button>
              </div>
            </div>

            {!selectedTopic ? (
              <div className="text-center py-8 text-slate-400 text-sm">{t('Select a topic to view its details')}</div>
            ) : detailTab === 'route' ? (
              routeLoading ? (
                <div className="text-center py-8 text-slate-400">{t('Loading...')}</div>
              ) : route ? (
                <div className="space-y-4 text-sm leading-6">
                  <div className="font-medium text-cyan-400">{selectedTopic}</div>
                  <div>
                    <div className="text-slate-400 mb-1.5">{t('Brokers')}</div>
                    {route.brokerDatas.map((b, i) => (
                      <div key={i} className="text-slate-200 mb-3">
                        <div>{b.brokerName}</div>
                        {Object.entries(b.brokerAddrs).map(([id, addr]) => (
                          <div key={id} className="text-xs text-slate-500 font-mono">
                            {id === '0' ? t('master') : `${t('slave')}-${id}`}: {addr}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1.5">{t('Queues')}</div>
                    {route.queueDatas.map((q, i) => (
                      <div key={i} className="text-slate-200 mb-2">
                        {q.brokerName}: {q.readQueueNums} {t('read')} / {q.writeQueueNums} {t('write')} ·{' '}
                        {t(formatPerm(q.perm))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">{t('Select a topic to view its route')}</div>
              )
            ) : statusLoading ? (
              <div className="text-center py-8 text-slate-400">{t('Loading...')}</div>
            ) : status ? (
              <div className="space-y-3 text-sm leading-6">
                <div className="font-medium text-cyan-400">{status.topic}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-400">{t('Messages in topic')}</div>
                    <div className="text-lg text-slate-100">{status.totalMessages.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-3">
                    <div className="text-xs text-slate-400">{t('Queues')}</div>
                    <div className="text-lg text-slate-100">{status.queues.length}</div>
                  </div>
                </div>
                {status.errors.length > 0 && (
                  <div className="text-xs text-amber-300 bg-amber-500/10 rounded p-2 break-all">
                    {status.errors.slice(0, 3).join('; ')}
                    {status.errors.length > 3 ? ` (+${status.errors.length - 3})` : ''}
                  </div>
                )}
                {status.queues.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">{t('No queue status available')}</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="text-left py-1.5 font-medium">{t('Broker')}</th>
                          <th className="text-right py-1.5 font-medium">{t('Queue')}</th>
                          <th className="text-right py-1.5 font-medium">{t('Min Offset')}</th>
                          <th className="text-right py-1.5 font-medium">{t('Max Offset')}</th>
                          <th className="text-right py-1.5 font-medium">{t('Message Count')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {status.queues.map((q, i) => (
                          <tr key={`${q.brokerName}-${q.queueId}-${i}`} className="text-slate-200">
                            <td className="py-1.5 pr-2 font-mono">{q.brokerName}</td>
                            <td className="py-1.5 text-right">{q.queueId}</td>
                            <td className="py-1.5 text-right">{q.minOffset.toLocaleString()}</td>
                            <td className="py-1.5 text-right">{q.maxOffset.toLocaleString()}</td>
                            <td className="py-1.5 text-right">{q.messageCount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">{t('Select a topic to view its status')}</div>
            )}
          </div>
          <LoadingMask active={loading} />
        </div>
      )}

      {/* Create Topic Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-96 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">{t('Create Topic')}</h3>
            <div>
              <label className="text-sm text-slate-400 block mb-1">{t('Topic Name')}</label>
              <input
                type="text"
                autoFocus
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">{t('Read Queues')}</label>
                <input
                  type="number"
                  value={readQueueNums}
                  onChange={(e) => setReadQueueNums(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">{t('Write Queues')}</label>
                <input
                  type="number"
                  value={writeQueueNums}
                  onChange={(e) => setWriteQueueNums(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">{t('Permission')}</label>
              <Select
                value={String(perm)}
                options={[
                  { value: '6', label: t('READ_WRITE') },
                  { value: '4', label: t('READ') },
                  { value: '2', label: t('WRITE') },
                ]}
                onChange={(value) => setPerm(Number(value))}
                ariaLabel={t('Permission')}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTopic.trim()}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50"
              >
                {creating ? t('Creating...') : t('Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {editTopic && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditTopic(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-[28rem] space-y-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">{t('Edit Topic')}</h3>
            <div className="text-sm text-cyan-400 font-mono break-all">{editTopic}</div>

            {editLoading ? (
              <div className="text-center py-6 text-slate-400">{t('Loading...')}</div>
            ) : (
              <>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">{t('Target Broker')}</label>
                  <Select
                    value={editBrokerAddr}
                    options={[
                      { value: '', label: t('All master brokers') },
                      ...masterBrokers(editRoute).map((broker) => ({
                        value: broker.addr,
                        label: `${broker.name} (${broker.addr})`,
                      })),
                    ]}
                    onChange={(value) => {
                      setEditBrokerAddr(value)
                      const queueData = editRoute?.queueDatas.find(
                        (q) => q.brokerName === masterBrokers(editRoute).find((b) => b.addr === value)?.name
                      )
                      if (queueData) {
                        setEditReadQueues(queueData.readQueueNums)
                        setEditWriteQueues(queueData.writeQueueNums)
                        setEditPerm(queueData.perm)
                      }
                    }}
                    ariaLabel={t('Target Broker')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{t('Read Queues')}</label>
                    <input
                      type="number"
                      min={1}
                      value={editReadQueues}
                      onChange={(e) => setEditReadQueues(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{t('Write Queues')}</label>
                    <input
                      type="number"
                      min={1}
                      value={editWriteQueues}
                      onChange={(e) => setEditWriteQueues(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">{t('Permission')}</label>
                  <Select
                    value={String(editPerm)}
                    options={[
                      { value: '6', label: t('READ_WRITE') },
                      { value: '4', label: t('READ') },
                      { value: '2', label: t('WRITE') },
                      { value: '0', label: t('NONE') },
                    ]}
                    onChange={(value) => setEditPerm(Number(value))}
                    ariaLabel={t('Permission')}
                  />
                </div>
                <p className="text-xs text-slate-500">{t('Queue counts and permission are applied to the selected brokers.')}</p>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditTopic(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating || editLoading || editReadQueues < 1 || editWriteQueues < 1}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50"
              >
                {updating ? t('Updating...') : t('Update')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Message Modal */}
      {sendTopic && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSendTopic(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-[32rem] space-y-4 max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">{t('Send Test Message')}</h3>
            <div className="text-sm text-cyan-400 font-mono break-all">{sendTopic}</div>

            {sendLoading ? (
              <div className="text-center py-6 text-slate-400">{t('Loading...')}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{t('Broker (optional)')}</label>
                    <Select
                      value={sendBroker}
                      options={[
                        { value: '', label: t('First available') },
                        ...masterBrokers(sendRoute).map((broker) => ({
                          value: broker.name,
                          label: broker.name,
                        })),
                      ]}
                      onChange={setSendBroker}
                      ariaLabel={t('Target Broker')}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{t('Queue ID (optional)')}</label>
                    <input
                      type="number"
                      min={0}
                      value={sendQueueId}
                      onChange={(e) => setSendQueueId(e.target.value)}
                      placeholder={t('Auto')}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{t('Tag (optional)')}</label>
                    <input
                      type="text"
                      value={sendTag}
                      onChange={(e) => setSendTag(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{t('Key (optional)')}</label>
                    <input
                      type="text"
                      value={sendKey}
                      onChange={(e) => setSendKey(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">{t('Message Body')}</label>
                  <textarea
                    rows={6}
                    autoFocus
                    value={sendBody}
                    onChange={(e) => setSendBody(e.target.value)}
                    placeholder={t('Enter the message content...')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {sendResult && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {t('Message sent')}
                    </div>
                    <div className="font-mono break-all">{t('Msg ID')}: {sendResult.msgId || '—'}</div>
                    <div className="font-mono">
                      {sendResult.brokerName} · {t('Queue')} {sendResult.queueId} · {t('Offset')} {sendResult.queueOffset}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSendTopic(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sendLoading || !sendBody.trim()}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? t('Sending...') : t('Send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
