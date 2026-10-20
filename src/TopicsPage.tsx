import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { List, RefreshCw, Plus, Trash2, Search } from 'lucide-react'

interface TopicsPageProps {
  connected: boolean
}

export default function TopicsPage({ connected }: TopicsPageProps) {
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadTopics = async () => {
    if (!connected) {
      setError('Please connect to RocketMQ first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await invoke<string[]>('get_topic_list')
      setTopics(result)
    } catch (err) {
      setError(err as string)
      console.error('Failed to load topics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected) {
      loadTopics()
    }
  }, [connected])

  const filteredTopics = topics.filter(topic =>
    topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filter out system topics
  const userTopics = filteredTopics.filter(topic =>
    !topic.startsWith('TBW102') &&
    !topic.startsWith('%RETRY%') &&
    !topic.startsWith('%DLQ%') &&
    topic !== 'SELF_TEST_TOPIC' &&
    topic !== 'BenchmarkTest' &&
    topic !== 'OFFSET_MOVED_EVENT' &&
    topic !== 'DefaultCluster'
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <List className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Topics</h1>
            <p className="text-sm text-slate-400">
              {userTopics.length} user topic{userTopics.length !== 1 ? 's' : ''} 
              {filteredTopics.length !== userTopics.length && ` (${filteredTopics.length - userTopics.length} system)`}
            </p>
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
            disabled={!connected}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Create Topic
          </button>
        </div>
      </div>

      {/* Search Bar */}
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

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Topic List */}
      {!connected ? (
        <div className="text-center py-12 text-slate-400">
          Please connect to RocketMQ to view topics
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading topics...
        </div>
      ) : userTopics.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchQuery ? 'No topics match your search' : 'No topics found'}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-sm">
                <th className="text-left px-6 py-3 font-medium">Topic Name</th>
                <th className="text-left px-6 py-3 font-medium">Broker Count</th>
                <th className="text-left px-6 py-3 font-medium">Write Queues</th>
                <th className="text-left px-6 py-3 font-medium">Read Queues</th>
                <th className="text-right px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {userTopics.map((topic, index) => (
                <tr key={index} className="hover:bg-slate-750 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-100">{topic}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">-</td>
                  <td className="px-6 py-4 text-slate-400">-</td>
                  <td className="px-6 py-4 text-slate-400">-</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-100">
                        <List className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-red-500/10 rounded transition-colors text-slate-400 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* System Topics (Collapsible) */}
      {filteredTopics.length > userTopics.length && (
        <details className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <summary className="px-6 py-3 cursor-pointer text-slate-400 hover:bg-slate-800 transition-colors">
            System Topics ({filteredTopics.length - userTopics.length})
          </summary>
          <div className="border-t border-slate-700">
            <div className="divide-y divide-slate-700">
              {filteredTopics.filter(topic => !userTopics.includes(topic)).map((topic, index) => (
                <div key={index} className="px-6 py-3 text-slate-500 text-sm font-mono">
                  {topic}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
