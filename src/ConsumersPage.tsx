import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Users, RefreshCw, Search, RotateCcw, Radio, List, X } from 'lucide-react'
import type {
  ConsumerConnection,
  ConsumerConnectionInfo,
  ConsumerProgress,
} from './types'
import Pagination from './components/Pagination'
import ErrorNotice from './components/ErrorNotice'
import { usePagination } from './hooks/usePagination'
import { useI18n } from './i18n'

interface ConsumersPageProps {
  connected: boolean
}

type ResetType = 'max' | 'min' | 'offset'

export default function ConsumersPage({ connected }: ConsumersPageProps) {
  const { t } = useI18n()
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [allTopics, setAllTopics] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConsumerConnection | null>(null)
  const [connectionLoading, setConnectionLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [subscriptionTopics, setSubscriptionTopics] = useState<string[]>([])

  const [topic, setTopic] = useState('')
  const [progress, setProgress] = useState<ConsumerProgress[]>([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [tps, setTps] = useState<number | null>(null)
  const sampleRef = useRef<{ group: string; topic: string; offset: number; time: number } | null>(null)

  const [showReset, setShowReset] = useState(false)
  const [resetTopic, setResetTopic] = useState('')
  const [resetQueue, setResetQueue] = useState('all')
  const [resetType, setResetType] = useState<ResetType>('max')
  const [resetOffsetValue, setResetOffsetValue] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const loadGroups = async () => {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<string[]>('get_consumer_groups')
      setGroups(result)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const loadAllTopics = async () => {
    if (!connected) return
    try {
      const result = await invoke<string[]>('get_topic_list')
      setAllTopics(result)
    } catch {
      setAllTopics([])
    }
  }

  const loadProgress = async (group: string, targetTopic: string, silent = false) => {
    if (!targetTopic) return
    if (!silent) setProgressLoading(true)
    try {
      const rows = await invoke<ConsumerProgress[]>('get_consumer_progress', {
        group,
        topic: targetTopic,
      })
      setProgress(rows)
      setProgressError(null)

      const totalConsumerOffset = rows.reduce((sum, row) => sum + row.consumerOffset, 0)
      const now = Date.now()
      const sample = sampleRef.current
      if (sample && sample.group === group && sample.topic === targetTopic) {
        const elapsedSeconds = (now - sample.time) / 1000
        const consumed = totalConsumerOffset - sample.offset
        setTps(elapsedSeconds > 0 && consumed >= 0 ? consumed / elapsedSeconds : 0)
      }
      sampleRef.current = { group, topic: targetTopic, offset: totalConsumerOffset, time: now }
    } catch (err) {
      // Keep the last successful snapshot when a background poll fails.
      if (!silent) {
        setProgressError(err as string)
        setProgress([])
      }
    } finally {
      if (!silent) setProgressLoading(false)
    }
  }

  const selectGroup = async (group: string) => {
    setSelectedGroup(group)
    setConnection(null)
    setConnectionLoading(true)
    setOffline(false)
    setSubscriptionTopics([])
    setTopic('')
    setProgress([])
    setProgressError(null)
    setTps(null)
    sampleRef.current = null

    try {
      const result = await invoke<ConsumerConnection | null>('get_consumer_connections', { group })
      if (result) {
        setConnection(result)
        const subscribed = Object.keys(result.subscriptionTable ?? {}).sort()
        setSubscriptionTopics(subscribed)
        if (subscribed.length > 0) {
          setTopic(subscribed[0])
          loadProgress(group, subscribed[0])
        }
      } else {
        setOffline(true)
      }
    } catch (err) {
      setError(err as string)
      setOffline(true)
    } finally {
      setConnectionLoading(false)
    }
  }

  const handleTopicChange = (next: string) => {
    setTopic(next)
    setTps(null)
    setProgress([])
    setProgressError(null)
    sampleRef.current = null
    if (selectedGroup && next) {
      loadProgress(selectedGroup, next)
    }
  }

  const openReset = () => {
    if (!selectedGroup) return
    const candidates = subscriptionTopics.length > 0 ? subscriptionTopics : allTopics
    setResetTopic(topic || candidates[0] || '')
    setResetQueue('all')
    setResetType('max')
    setResetOffsetValue('')
    setResetMessage(null)
    setShowReset(true)
  }

  const handleReset = async () => {
    if (!selectedGroup || !resetTopic) return
    if (resetType === 'offset' && resetOffsetValue.trim() === '') {
      setResetMessage('Please enter an offset value')
      return
    }

    setResetting(true)
    setResetMessage(null)
    try {
      const applied = await invoke<number>('reset_consumer_offset', {
        group: selectedGroup,
        topic: resetTopic,
        queueId: resetQueue === 'all' ? null : Number(resetQueue),
        offsetType: resetType,
        offset: resetType === 'offset' ? Number(resetOffsetValue) : null,
      })
      setShowReset(false)
      if (resetTopic === topic) {
        setTps(null)
        sampleRef.current = null
        await loadProgress(selectedGroup, resetTopic)
      }
      setError(null)
      setResetMessage(t('Reset {count} queue(s) to {type}', { count: applied, type: t(resetType) }))
    } catch (err) {
      setResetMessage(err as string)
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    if (!selectedGroup || !topic) return
    const timer = setInterval(() => {
      // Background refresh: keep the current table on screen while polling.
      loadProgress(selectedGroup, topic, true)
    }, 5000)
    return () => clearInterval(timer)
  }, [selectedGroup, topic])

  useEffect(() => {
    if (!showReset) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowReset(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showReset])

  useEffect(() => {
    if (connected) {
      loadGroups()
      loadAllTopics()
    } else {
      setGroups([])
      setAllTopics([])
      setSelectedGroup(null)
      setConnection(null)
      setProgress([])
      setTps(null)
      sampleRef.current = null
    }
  }, [connected])

  const filteredGroups = groups.filter((group) =>
    group.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const groupPager = usePagination(filteredGroups, 15)

  const totalLag = progress.reduce((sum, row) => sum + row.lag, 0)
  const maxLag = progress.reduce((max, row) => Math.max(max, row.lag), 0)
  const topicOptions = subscriptionTopics.length > 0 ? subscriptionTopics : allTopics
  const resetQueueOptions =
    resetTopic === topic ? Array.from(new Set(progress.map((row) => row.queueId))).sort((a, b) => a - b) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Users className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">{t('Consumers')}</h1>
            <p className="text-sm text-slate-400">
              {filteredGroups.length} {t(filteredGroups.length === 1 ? 'consumer group' : 'consumer groups')}
            </p>
          </div>
        </div>

        <button
          onClick={loadGroups}
          disabled={!connected || loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('Refresh')}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder={t('Search consumer groups...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {error && <ErrorNotice error={error} />}

      {resetMessage && (
        <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300">
          {resetMessage}
        </div>
      )}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">
          {t('Please connect to RocketMQ to view consumer groups')}
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          {t('Loading consumer groups...')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Group list */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-slate-400 text-sm font-medium">
              {t('Groups ({count})', { count: filteredGroups.length })}
            </div>
            <div className="max-h-[32rem] overflow-y-auto divide-y divide-slate-700">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {searchQuery ? t('No groups match your search') : t('No consumer groups found')}
                </div>
              ) : (
                groupPager.pageItems.map((group) => (
                  <button
                    key={group}
                    onClick={() => selectGroup(group)}
                    className={`w-full text-left px-5 py-3.5 transition-colors ${
                      selectedGroup === group
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-200 hover:bg-slate-750'
                    }`}
                  >
                    {group}
                  </button>
                ))
              )}
            </div>
            <Pagination
              page={groupPager.page}
              pageSize={groupPager.pageSize}
              total={groupPager.total}
              totalPages={groupPager.totalPages}
              onPageChange={groupPager.setPage}
              onPageSizeChange={groupPager.setPageSize}
            />
          </div>

          {/* Detail */}
          <div className="col-span-2 space-y-4">
            {!selectedGroup ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center text-slate-400">
                {t('Select a consumer group to view its progress and connections')}
              </div>
            ) : (
              <>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-cyan-400">{selectedGroup}</div>
                      {connectionLoading ? (
                        <span className="text-xs text-slate-400">{t('Loading...')}</span>
                      ) : offline ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">{t('Offline')}</span>
                      ) : connection ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400">{t('Online')}</span>
                      ) : null}
                    </div>
                    <button
                      onClick={openReset}
                      className="px-3 py-1.5 text-sm bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {t('Reset Offset')}
                    </button>
                  </div>

                  {connection && (
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div>
                        <span className="text-slate-400">{t('Consume Type:')}</span>{' '}
                        <span className="text-slate-200">{connection.consumeType ?? '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">{t('Message Model:')}</span>{' '}
                        <span className="text-slate-200">{connection.messageModel ?? '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">{t('From Where:')}</span>{' '}
                        <span className="text-slate-200">{connection.consumeFromWhere ?? '-'}</span>
                      </div>
                    </div>
                  )}

                  {offline && (
                    <div className="text-sm text-amber-400/90">
                      {t('This consumer group is not online. Select a topic below to inspect its committed offsets.')}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{t('Online Instances')}</div>
                      <div className="text-xl font-semibold text-slate-100">
                        {connection?.connectionSet.length ?? 0}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{t('Queues')}</div>
                      <div className="text-xl font-semibold text-slate-100">{progress.length}</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{t('Total Lag')}</div>
                      <div className={`text-xl font-semibold ${totalLag > 0 ? 'text-orange-400' : 'text-slate-100'}`}>
                        {totalLag.toLocaleString()}
                        {maxLag > 0 && (
                          <span className="text-xs font-normal text-slate-400 ml-2">{t('max {value}', { value: maxLag.toLocaleString() })}</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{t('Consume TPS')}</div>
                      <div
                        className={`text-xl font-semibold ${
                          tps !== null && tps > 0 ? 'text-green-400' : 'text-slate-100'
                        }`}
                      >
                        {tps === null
                          ? '—'
                          : tps.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        {tps !== null && (
                          <span className="text-xs font-normal text-slate-400 ml-1">{t('msg/s')}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate" title={topic}>
                        {tps === null ? t('sampling…') : topic || t('no topic selected')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <div className="px-5 py-4 bg-slate-900 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-200 font-medium">
                      <List className="w-4 h-4 text-slate-400" />
                      {t('Consume Progress')}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={topic}
                        onChange={(e) => handleTopicChange(e.target.value)}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">{t('Select a topic...')}</option>
                        {topicOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => selectedGroup && topic && loadProgress(selectedGroup, topic)}
                        disabled={!topic || progressLoading}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-100 disabled:opacity-50"
                        title={t('Refresh progress')}
                      >
                        <RefreshCw className={`w-4 h-4 ${progressLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {progressError && (
                    <div className="px-4 py-3 text-sm text-red-400 border-b border-slate-700">{progressError}</div>
                  )}

                  {progressLoading && progress.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">{t('Loading progress...')}</div>
                  ) : progress.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      {topic ? t('No progress data for this topic') : t('Select a topic to view consume progress')}
                    </div>
                  ) : (
                    <div className="max-h-[24rem] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-slate-900">
                          <tr className="text-slate-400 text-xs">
                    <th className="text-left px-4 py-2 font-medium">{t('Broker')}</th>
                    <th className="text-left px-4 py-2 font-medium">{t('Queue')}</th>
                    <th className="text-right px-4 py-2 font-medium">{t('Broker Offset')}</th>
                    <th className="text-right px-4 py-2 font-medium">{t('Consumer Offset')}</th>
                    <th className="text-right px-4 py-2 font-medium">{t('Lag')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {progress.map((row) => (
                            <tr key={`${row.brokerName}-${row.queueId}`} className="hover:bg-slate-750 text-sm">
                              <td className="px-4 py-2 text-slate-300">{row.brokerName}</td>
                              <td className="px-4 py-2 text-slate-300">{row.queueId}</td>
                              <td className="px-4 py-2 text-right text-slate-300 font-mono">
                                {row.brokerOffset.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-300 font-mono">
                                {row.consumerOffset.toLocaleString()}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-mono ${
                                  row.lag > 0 ? 'text-orange-400' : 'text-green-400'
                                }`}
                              >
                                {row.lag.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Connections */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <div className="px-5 py-4 bg-slate-900 flex items-center gap-2 text-slate-200 font-medium">
                    <Radio className="w-4 h-4 text-slate-400" />
                    Online Connections
                  </div>
                  {!connection || connection.connectionSet.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      {connectionLoading ? 'Loading connections...' : 'No online clients'}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 text-xs">
                          <th className="text-left px-4 py-2 font-medium">{t('Client ID')}</th>
                          <th className="text-left px-4 py-2 font-medium">{t('Address')}</th>
                          <th className="text-left px-4 py-2 font-medium">{t('Language')}</th>
                          <th className="text-left px-4 py-2 font-medium">{t('Version')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {connection.connectionSet.map((client: ConsumerConnectionInfo) => (
                          <tr key={client.clientId} className="hover:bg-slate-750 text-sm">
                            <td className="px-4 py-2 text-slate-300">{client.clientId}</td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{client.clientAddr}</td>
                            <td className="px-4 py-2 text-slate-400">{client.language}</td>
                            <td className="px-4 py-2 text-slate-400">{client.version}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset Offset Modal */}
      {showReset && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowReset(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-[28rem] max-h-[90vh] overflow-y-auto space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">{t('Reset Consumer Offset')}</h3>
              <button
                onClick={() => setShowReset(false)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm text-slate-400">
              Group: <span className="text-slate-200">{selectedGroup}</span>
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">{t('Topic')}</label>
              <select
                value={resetTopic}
                onChange={(e) => setResetTopic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="">{t('Select a topic...')}</option>
                {topicOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">{t('Queue')}</label>
              <select
                value={resetQueue}
                onChange={(e) => setResetQueue(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">{t('All queues')}</option>
                {resetQueueOptions.map((q) => (
                  <option key={q} value={q}>
                    {t('Queue {id}', { id: q })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-400 block mb-1">{t('Reset To')}</label>
              <select
                value={resetType}
                onChange={(e) => setResetType(e.target.value as ResetType)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="max">{t('Latest offset (max)')}</option>
                <option value="min">{t('Earliest offset (min)')}</option>
                <option value="offset">{t('Custom offset')}</option>
              </select>
            </div>

            {resetType === 'offset' && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">{t('Offset')}</label>
                <input
                type="number"
                autoFocus={resetType === 'offset'}
                  value={resetOffsetValue}
                  onChange={(e) => setResetOffsetValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {resetMessage && <div className="text-sm text-red-400">{resetMessage}</div>}

            <div className="text-xs text-amber-400/80">
              {t('This changes the committed offsets for the consumer group and cannot be undone.')}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReset(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                {t('Cancel')}
              </button>
              <button
                onClick={handleReset}
                disabled={resetting || !resetTopic}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg disabled:opacity-50"
              >
                {resetting ? t('Resetting...') : t('Reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
