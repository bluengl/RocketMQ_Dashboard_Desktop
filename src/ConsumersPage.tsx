import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Users, RefreshCw, Search, AlertCircle } from 'lucide-react'

interface ConsumersPageProps {
  connected: boolean
}

export default function ConsumersPage({ connected }: ConsumersPageProps) {
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadConsumerGroups = async () => {
    if (!connected) {
      setError('Please connect to RocketMQ first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await invoke<string[]>('get_consumer_groups')
      setGroups(result)
    } catch (err) {
      setError(err as string)
      console.error('Failed to load consumer groups:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected) {
      loadConsumerGroups()
    }
  }, [connected])

  const filteredGroups = groups.filter(group =>
    group.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Users className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Consumer Groups</h1>
            <p className="text-sm text-slate-400">
              {filteredGroups.length} consumer group{filteredGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadConsumerGroups}
            disabled={!connected || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search consumer groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Consumer Groups List */}
      {!connected ? (
        <div className="text-center py-12 text-slate-400">
          Please connect to RocketMQ to view consumer groups
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading consumer groups...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchQuery ? 'No consumer groups match your search' : 'No consumer groups found'}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 text-slate-400 text-sm">
                <th className="text-left px-6 py-3 font-medium">Group Name</th>
                <th className="text-left px-6 py-3 font-medium">Consume Type</th>
                <th className="text-left px-6 py-3 font-medium">Message Model</th>
                <th className="text-left px-6 py-3 font-medium">Online Instances</th>
                <th className="text-left px-6 py-3 font-medium">Total Lag</th>
                <th className="text-right px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredGroups.map((group, index) => (
                <tr key={index} className="hover:bg-slate-750 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-100">{group}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">-</td>
                  <td className="px-6 py-4 text-slate-400">-</td>
                  <td className="px-6 py-4 text-slate-400">-</td>
                  <td className="px-6 py-4">
                    <span className="text-slate-400">-</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors">
                        View Progress
                      </button>
                      <button className="px-3 py-1 text-sm bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded transition-colors">
                        Reset Offset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
