import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Search, Send, RefreshCw, Users } from 'lucide-react'
import type { ProducerConnectionInfo } from './types'
import { errorMessage } from './utils/errors'
import Pagination from './components/Pagination'
import ErrorNotice from './components/ErrorNotice'
import LoadingMask from './components/LoadingMask'
import ComboBox from './components/ComboBox'
import { filterUserTopics } from './utils/topics'
import { usePagination } from './hooks/usePagination'
import { useI18n } from './i18n'

interface ProducerPageProps {
  connected: boolean
}

export default function ProducerPage({ connected }: ProducerPageProps) {
  const { t } = useI18n()
  const [groups, setGroups] = useState<string[]>([])
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [topicFilter, setTopicFilter] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [connections, setConnections] = useState<ProducerConnectionInfo[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [connectionsError, setConnectionsError] = useState<string | null>(null)

  // GET_ALL_PRODUCER_INFO lists groups but carries no connection state, so probe
  // each group's connection list (bounded concurrency) to derive online status.
  const loadStatuses = async (list: string[]) => {
    const entries: Array<[string, boolean]> = []
    const queue = [...list]
    const worker = async () => {
      for (;;) {
        const group = queue.shift()
        if (!group) return
        try {
          const result = await invoke<ProducerConnectionInfo[]>('get_producer_connections', {
            group,
            topic: null,
          })
          entries.push([group, result.length > 0])
        } catch {
          entries.push([group, false])
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, list.length) }, () => worker()))
    setOnlineMap(Object.fromEntries(entries))
  }

  const loadGroups = async () => {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<string[]>('get_producer_groups')
      setGroups(result)
      setOnlineMap({})
      void loadStatuses(result)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const loadConnections = async (group: string, topic = topicFilter) => {
    setConnectionsLoading(true)
    setConnectionsError(null)
    try {
      const result = await invoke<ProducerConnectionInfo[]>('get_producer_connections', {
        group,
        topic: topic.trim() || null,
      })
      setConnections(result)
      setOnlineMap((previous) => ({ ...previous, [group]: result.length > 0 }))
    } catch (err) {
      setConnectionsError(errorMessage(err))
      setConnections([])
    } finally {
      setConnectionsLoading(false)
    }
  }

  const selectGroup = (group: string) => {
    setSelectedGroup(group)
    setConnections([])
    setConnectionsError(null)
    void loadConnections(group)
  }

  useEffect(() => {
    if (!connected) {
      setTopics([])
      return
    }
    let cancelled = false
    invoke<string[]>('get_topic_list')
      .then((list) => {
        if (!cancelled) setTopics(filterUserTopics(list).sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => {
        if (!cancelled) setTopics([])
      })
    return () => {
      cancelled = true
    }
  }, [connected])

  useEffect(() => {
    if (connected) {
      loadGroups()
    } else {
      setGroups([])
      setOnlineMap({})
      setSelectedGroup(null)
      setConnections([])
    }
  }, [connected])

  const filteredGroups = groups.filter((group) =>
    group.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const groupPager = usePagination(filteredGroups, 15)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Send className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">{t('Producers')}</h1>
            <p className="text-sm text-slate-400">
              {filteredGroups.length} {t(filteredGroups.length === 1 ? 'producer group' : 'producer groups')}
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
          placeholder={t('Search producer groups...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {error && <ErrorNotice error={error} />}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">
          {t('Please connect to RocketMQ to view producers')}
        </div>
      ) : (
        <div className="rmq-loading-wrap grid grid-cols-3 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-slate-400 text-sm font-medium">
              {t('Groups ({count})', { count: filteredGroups.length })}
            </div>
            <div className="max-h-[32rem] overflow-y-auto divide-y divide-slate-700">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-14 text-slate-400 text-sm px-4">
                  {searchQuery ? t('No groups match your search') : t('No producer groups found')}
                </div>
              ) : (
                groupPager.pageItems.map((group) => (
                  <button
                    key={group}
                    onClick={() => selectGroup(group)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedGroup === group
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-200 hover:bg-slate-750'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{group}</span>
                      {onlineMap[group] !== undefined && (
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                            onlineMap[group]
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {t(onlineMap[group] ? 'Online' : 'Offline')}
                        </span>
                      )}
                    </span>
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

          <div className="col-span-2 space-y-4">
            {!selectedGroup ? (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center text-slate-400">
                {t('Select a producer group to view its online clients')}
              </div>
            ) : (
              <>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-cyan-400">{selectedGroup}</div>
                      {onlineMap[selectedGroup] !== undefined && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            onlineMap[selectedGroup]
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {t(onlineMap[selectedGroup] ? 'Online' : 'Offline')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-72 max-w-full">
                        <ComboBox
                          value={topicFilter}
                          options={topics}
                          onChange={setTopicFilter}
                          onSubmit={(value) => selectedGroup && loadConnections(selectedGroup, value ?? topicFilter)}
                          submitOnSelect
                          placeholder={t('Optional topic (limits brokers queried)')}
                          ariaLabel={t('Topic')}
                          emptyLabel={t('No matching topics')}
                        />
                      </div>
                      <button
                        onClick={() => loadConnections(selectedGroup)}
                        disabled={connectionsLoading}
                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-100 disabled:opacity-50"
                        title={t('Reload connections')}
                      >
                        <RefreshCw className={`w-4 h-4 ${connectionsLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{t('Online Instances')}</div>
                      <div className="text-xl font-semibold text-slate-100">
                        {connections.length}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400">{t('Scope')}</div>
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {topicFilter.trim() ? `brokers hosting ${topicFilter.trim()}` : t('all master brokers')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <div className="px-5 py-4 bg-slate-900 flex items-center gap-2 text-slate-200 font-medium">
                    <Users className="w-4 h-4 text-slate-400" />
                    {t('Online Connections')}
                  </div>

                  {connectionsError && <ErrorNotice error={connectionsError} compact />}

                  {connectionsLoading ? (
                    <div className="text-center py-14 text-slate-400 text-sm">
                    {t('Loading connections...')}
                    </div>
                  ) : connections.length === 0 ? (
                    <div className="text-center py-14 text-slate-400 text-sm">
                    {t('No online producer clients for this group')}
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
                        {connections.map((client) => (
                          <tr
                            key={`${client.clientId}|${client.clientAddr}`}
                            className="hover:bg-slate-750 text-sm"
                          >
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
          <LoadingMask active={loading} />
        </div>
      )}
    </div>
  )
}
