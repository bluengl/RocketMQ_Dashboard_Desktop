import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Activity, Database, List, MessageSquare, Users, Shield, GitBranch, Settings } from 'lucide-react'
import TopicsPage from './TopicsPage'
import ConsumersPage from './ConsumersPage'
import MessagePage from './MessagePage'
import TracePage from './TracePage'
import DashboardPage from './DashboardPage'
import ClusterPage from './ClusterPage'
import AclPage from './AclPage'
import './App.css'

type Page = 'dashboard' | 'topics' | 'consumers' | 'messages' | 'cluster' | 'acl' | 'trace' | 'ops'

function App() {
  const [nameServer, setNameServer] = useState('192.168.153.149:9876')
  const [aclEnabled, setAclEnabled] = useState(false)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [traceTarget, setTraceTarget] = useState<string | null>(null)

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)

    try {
      await invoke('connect_cluster', {
        config: {
          name_server_addrs: [nameServer],
          acl_enabled: aclEnabled,
          access_key: aclEnabled ? accessKey : null,
          secret_key: aclEnabled ? secretKey : null,
        },
      })
      setConnected(true)
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
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

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
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={aclEnabled}
                  onChange={(e) => setAclEnabled(e.target.checked)}
                  disabled={connected}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                />
                ACL
              </label>
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
          {aclEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="text"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                disabled={connected}
                placeholder="Access Key"
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                disabled={connected}
                placeholder="Secret Key"
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <span className="text-xs text-slate-500">
                Requests are signed with HMAC-SHA1
              </span>
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === 'dashboard' && <DashboardPage connected={connected} />}

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

          {currentPage === 'cluster' && <ClusterPage connected={connected} />}

          {currentPage === 'acl' && <AclPage connected={connected} />}

          {currentPage !== 'dashboard' && currentPage !== 'topics' && currentPage !== 'consumers' && currentPage !== 'messages' && currentPage !== 'trace' && currentPage !== 'cluster' && currentPage !== 'acl' && (
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

