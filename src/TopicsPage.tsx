import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { List, RefreshCw, Plus, Trash2, Search, Route } from 'lucide-react'
import type { TopicRouteData } from './types'

interface TopicsPageProps {
  connected: boolean
}

const PERM_LABEL: Record<number, string> = {
  2: 'WRITE',
  4: 'READ',
  6: 'READ_WRITE',
}

export default function TopicsPage({ connected }: TopicsPageProps) {
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [readQueueNums, setReadQueueNums] = useState(8)
  const [writeQueueNums, setWriteQueueNums] = useState(8)
  const [perm, setPerm] = useState(6)
  const [creating, setCreating] = useState(false)

  const [routeTopic, setRouteTopic] = useState<string | null>(null)
  const [route, setRoute] = useState<TopicRouteData | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

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
    setRouteTopic(topic)
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

  const handleCreate = async () => {
    if (!newTopic.trim()) return
    setCreating(true)
    setError(null)
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
    if (!window.confirm(`Delete topic "${topic}"?`)) return
    setError(null)
    try {
      await invoke('delete_topic', { topic })
      await loadTopics()
      if (routeTopic === topic) {
        setRouteTopic(null)
        setRoute(null)
      }
    } catch (err) {
      setError(err as string)
    }
  }

  useEffect(() => {
    if (connected) {
      loadTopics()
    }
  }, [connected])

  const filteredTopics = topics.filter((topic) =>
    topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const userTopics = filteredTopics.filter(
    (topic) =>
      !topic.startsWith('TBW102') &&
      !topic.startsWith('%RETRY%') &&
      !topic.startsWith('%DLQ%') &&
      topic !== 'SELF_TEST_TOPIC' &&
      topic !== 'BenchmarkTest' &&
      topic !== 'OFFSET_MOVED_EVENT' &&
      topic !== 'DefaultCluster' &&
      !topic.startsWith('rmq_sys_') &&
      !topic.startsWith('RMQ_SYS_') &&
      !topic.startsWith('SCHEDULE_TOPIC_') &&
      !topic.startsWith('DefaultCluster_')
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <List className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Topics</h1>
            <p className="text-sm text-slate-400">{userTopics.length} user topics</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadTopics}
            disabled={!connected || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!connected}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Create Topic
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">{error}</div>
      )}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">Please connect to RocketMQ to view topics</div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading topics...
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900 text-slate-400 text-sm">
                  <th className="text-left px-6 py-3 font-medium">Topic Name</th>
                  <th className="text-right px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {userTopics.map((topic, index) => (
                  <tr key={index} className="hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-100">{topic}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => loadRoute(topic)}
                          className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-100"
                          title="View route"
                        >
                          <Route className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(topic)}
                          className="p-2 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-400"
                          title="Delete topic"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Route detail */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="font-medium text-slate-200 mb-3">Topic Route</div>
            {routeLoading ? (
              <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : route && routeTopic ? (
              <div className="space-y-4 text-sm">
                <div className="font-medium text-cyan-400">{routeTopic}</div>
                <div>
                  <div className="text-slate-400 mb-1">Brokers</div>
                  {route.brokerDatas.map((b, i) => (
                    <div key={i} className="text-slate-200 mb-2">
                      <div>{b.brokerName}</div>
                      {Object.entries(b.brokerAddrs).map(([id, addr]) => (
                        <div key={id} className="text-xs text-slate-500 font-mono">
                          {id === '0' ? 'master' : `slave-${id}`}: {addr}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Queues</div>
                  {route.queueDatas.map((q, i) => (
                    <div key={i} className="text-slate-200 mb-1">
                      {q.brokerName}: {q.readQueueNums} read / {q.writeQueueNums} write ·{' '}
                      {PERM_LABEL[q.perm] ?? q.perm}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">Select a topic to view its route</div>
            )}
          </div>
        </div>
      )}

      {/* Create Topic Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Create Topic</h3>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Topic Name</label>
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Read Queues</label>
                <input
                  type="number"
                  value={readQueueNums}
                  onChange={(e) => setReadQueueNums(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Write Queues</label>
                <input
                  type="number"
                  value={writeQueueNums}
                  onChange={(e) => setWriteQueueNums(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Permission</label>
              <select
                value={perm}
                onChange={(e) => setPerm(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value={6}>READ_WRITE</option>
                <option value={4}>READ</option>
                <option value={2}>WRITE</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newTopic.trim()}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
