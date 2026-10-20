import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Activity, Database, List, MessageSquare, Users, Shield, GitBranch, Settings } from 'lucide-react'
import TopicsPage from './TopicsPage'
import ConsumersPage from './ConsumersPage'
import MessagePage from './MessagePage'
import TracePage from './TracePage'
import type { ClusterInfo } from './types'
import './App.css'

type Page = 'dashboard' | 'topics' | 'consumers' | 'messages' | 'cluster' | 'acl' | 'trace' | 'ops'

function App() {
  const [nameServer, setNameServer] = useState('192.168.153.149:9876')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [traceTarget, setTraceTarget] = useState<string | null>(null)

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)

    try {
      await invoke('connect_cluster', {
        config: {
          name_server_addrs: [nameServer],
          acl_enabled: false,
          access_key: null,
          secret_key: null,
        },
      })
      setConnected(true)
      await loadClusterInfo()
    } catch (err) {
      setError(err as string)
      setConnected(false)
      console.error('Connection failed:', err)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await invoke('disconnect_cluster')
      setConnected(false)
      setClusterInfo(null)
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  const loadClusterInfo = async () => {
    if (!connected) return

    try {
      const info = await invoke<ClusterInfo>('get_cluster_info')
      setClusterInfo(info)
    } catch (err) {
      console.error('Failed to load cluster info:', err)
    }
  }

  useEffect(() => {
    if (connected) {
      const interval = setInterval(loadClusterInfo, 5000)
      return () => clearInterval(interval)
    }
  }, [connected])

  const navItems: Array<{ id: Page; icon: typeof Activity; label: string }> = [
    { id: 'dashboard', icon: Activity, label: 'Dashboard' },
    { id: 'topics', icon: List, label: 'Topics' },
    { id: 'consumers', icon: Users, label: 'Consumers' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'cluster', icon: Database, label: 'Cluster' },
    { id: 'acl', icon: Shield, label: 'ACL' },
    { id: 'trace', icon: GitBranch, label: 'Trace' },
    { id: 'ops', icon: Settings, label: 'OPS' },
  ]

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-cyan-400">RocketMQ</h1>
          <p className="text-sm text-slate-400">Management Console</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentPage === item.id
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Connection Status */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-slate-600'
              }`}
            />
            <span className="text-slate-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-slate-950 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold capitalize">{currentPage}</h2>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={nameServer}
                onChange={(e) => setNameServer(e.target.value)}
                disabled={connected}
                placeholder="NameServer Address"
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              {connected ? (
                <button
                  onClick={handleDisconnect}
                  className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting || !nameServer}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              {connected && clusterInfo && (
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-cyan-500/10 rounded-lg">
                        <Database className="w-8 h-8 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-slate-50">
                          {clusterInfo.brokers.length}
                        </div>
                        <div className="text-sm text-slate-400">Brokers</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-orange-500/10 rounded-lg">
                        <List className="w-8 h-8 text-orange-400" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-slate-50">
                          {clusterInfo.total_topics}
                        </div>
                        <div className="text-sm text-slate-400">Topics</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/10 rounded-lg">
                        <Users className="w-8 h-8 text-green-400" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-slate-50">
                          {clusterInfo.total_groups}
                        </div>
                        <div className="text-sm text-slate-400">Consumer Groups</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Broker List */}
              {connected && clusterInfo && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg">
                  <div className="px-6 py-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold">Broker List</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 text-sm">
                          <th className="text-left px-6 py-3 font-medium">Broker Name</th>
                          <th className="text-left px-6 py-3 font-medium">Cluster</th>
                          <th className="text-left px-6 py-3 font-medium">Address</th>
                          <th className="text-left px-6 py-3 font-medium">Version</th>
                          <th className="text-left px-6 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {clusterInfo.brokers.map((broker, index) => (
                          <tr key={index} className="hover:bg-slate-750 transition-colors">
                            <td className="px-6 py-4 font-medium">{broker.broker_name}</td>
                            <td className="px-6 py-4 text-slate-400">{broker.cluster_name}</td>
                            <td className="px-6 py-4 text-slate-400 font-mono text-sm">
                              {broker.broker_addrs.join(', ')}
                            </td>
                            <td className="px-6 py-4 text-slate-400">{broker.version}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  broker.online
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}
                              >
                                {broker.online ? 'Online' : 'Offline'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!connected && (
                <div className="text-center py-20 text-slate-400">
                  <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Connect to RocketMQ to view dashboard</p>
                </div>
              )}
            </div>
          )}

          {currentPage === 'topics' && <TopicsPage connected={connected} />}

          {currentPage === 'consumers' && <ConsumersPage connected={connected} />}

          {currentPage === 'messages' && (
            <MessagePage
              connected={connected}
              onViewTrace={(msgId) => {
                setTraceTarget(msgId)
                setCurrentPage('trace')
              }}
            />
          )}

          {currentPage === 'trace' && (
            <TracePage connected={connected} initialMsgId={traceTarget} />
          )}

          {currentPage !== 'dashboard' && currentPage !== 'topics' && currentPage !== 'consumers' && currentPage !== 'messages' && currentPage !== 'trace' && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-lg">{currentPage.toUpperCase()} page - Coming soon</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App

