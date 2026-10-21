import { useEffect, useLayoutEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Activity, Database, List, MessageSquare, Users, Send, Shield, GitBranch, Settings, Moon, Sun, RadioTower, Languages, Unplug, Minus, Square, Copy, X } from 'lucide-react'
import TopicsPage from './TopicsPage'
import ConsumersPage from './ConsumersPage'
import ProducerPage from './ProducerPage'
import MessagePage from './MessagePage'
import TracePage from './TracePage'
import DashboardPage from './DashboardPage'
import ClusterPage from './ClusterPage'
import AclPage from './AclPage'
import OpsPage from './OpsPage'
import type { ClusterProfile } from './types'
import { errorMessage } from './utils/errors'
import ErrorBoundary from './components/ErrorBoundary'
import NameServerCombo from './components/NameServerCombo'
import { addNameServerHistory, loadNameServerHistory } from './utils/nameServerHistory'
import { useI18n } from './i18n'

type Page = 'dashboard' | 'topics' | 'consumers' | 'producers' | 'messages' | 'cluster' | 'acl' | 'trace' | 'ops'

// Keeps visited pages mounted so switching tabs preserves selections and loaded data.
function PageSlot({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div className="page-slot" style={{ display: active ? undefined : 'none' }} aria-hidden={!active}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  )
}

function App() {
  const { language, setLanguage, t } = useI18n()
  const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const [maximized, setMaximized] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('rocketmq.theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [nameServer, setNameServer] = useState(() => loadNameServerHistory()[0] ?? '')
  const [aclEnabled, setAclEnabled] = useState(false)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [traceTarget, setTraceTarget] = useState<string | null>(null)
  const [visitedPages, setVisitedPages] = useState<Page[]>(['dashboard'])

  useEffect(() => {
    setVisitedPages((previous) =>
      previous.includes(currentPage) ? previous : [...previous, currentPage]
    )
  }, [currentPage])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('rocketmq.theme', theme)
    } catch {
      // Keep the selected appearance for this session when storage is disabled.
    }
  }, [theme])

  useEffect(() => {
    if (!isDesktop) return
    let unlisten: (() => void) | undefined
    try {
      const appWindow = getCurrentWindow()
      const sync = () => {
        appWindow.isMaximized().then(setMaximized).catch(() => {})
      }
      sync()
      appWindow
        .onResized(sync)
        .then((fn) => {
          unlisten = fn
        })
        .catch(() => {})
    } catch {
      // Window API unavailable (e.g. running in a plain browser preview).
    }
    return () => unlisten?.()
  }, [isDesktop])

  const minimizeWindow = () => {
    if (!isDesktop) return
    try {
      getCurrentWindow().minimize().catch(() => {})
    } catch {
      // Window API unavailable.
    }
  }

  const toggleMaximizeWindow = () => {
    if (!isDesktop) return
    try {
      const appWindow = getCurrentWindow()
      appWindow
        .toggleMaximize()
        .then(() => appWindow.isMaximized().then(setMaximized).catch(() => {}))
        .catch(() => {})
    } catch {
      // Window API unavailable.
    }
  }

  const closeWindow = () => {
    if (!isDesktop) return
    try {
      getCurrentWindow().close().catch(() => {})
    } catch {
      // Window API unavailable.
    }
  }

  const handleDragRegionDoubleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    // Never maximize when the double click landed on an interactive control.
    if (target.closest('button, input, select, textarea, label, a, [role="button"], [role="option"]')) {
      return
    }
    if (target.closest('[data-tauri-drag-region]')) {
      toggleMaximizeWindow()
    }
  }

  const connectTo = async (
    server: string,
    useAcl: boolean,
    access: string,
    secret: string
  ): Promise<boolean> => {
    setConnecting(true)
    setError(null)

    // Accept comma-separated NameServers, e.g. "10.0.0.1:9876,10.0.0.2:9876".
    const nameServers = server
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    if (nameServers.length === 0) {
      setError(t('NameServer Address is required'))
      setConnecting(false)
      return false
    }

    try {
      if (connected) {
        await invoke('disconnect_cluster')
        setConnected(false)
      }
      await invoke('connect_cluster', {
        config: {
          name_server_addrs: nameServers,
          acl_enabled: useAcl,
          access_key: useAcl ? access : null,
          secret_key: useAcl ? secret : null,
        },
      })
      setNameServer(server)
      setAclEnabled(useAcl)
      setAccessKey(useAcl ? access : '')
      setSecretKey(useAcl ? secret : '')
      setConnected(true)
      addNameServerHistory(server)
      return true
    } catch (err) {
      setError(errorMessage(err))
      setConnected(false)
      console.error('Connection failed:', err)
      return false
    } finally {
      setConnecting(false)
    }
  }

  const handleConnect = () => connectTo(nameServer, aclEnabled, accessKey, secretKey)
  const displayError = (message: string | null) => {
    if (!message) return null
    const match = message.match(/^Connection to (.+?) failed: (.+)$/)
    if (match) return t('Connection to {address} failed: {error}', { address: match[1], error: match[2] })
    return message
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
    { id: 'producers', icon: Send, label: 'Producers' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'cluster', icon: Database, label: 'Cluster' },
    { id: 'acl', icon: Shield, label: 'ACL' },
    { id: 'trace', icon: GitBranch, label: 'Trace' },
    { id: 'ops', icon: Settings, label: 'OPS' },
  ]

  const pageTitle = navItems.find((item) => item.id === currentPage)?.label ?? 'Dashboard'

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <div className="app-brand-mark"><RadioTower size={21} strokeWidth={2.1} /></div>
          <div className="app-brand-copy">
            <h1>RocketMQ</h1>
            <p>{t('Management Console')}</p>
          </div>
          <span className="app-version">0.3</span>
        </div>

        <div className="app-nav-label">{t('WORKSPACE')}</div>
        <nav className="app-nav" aria-label={t('Primary navigation')}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`app-nav-item ${currentPage === item.id ? 'is-active' : ''}`}
                aria-current={currentPage === item.id ? 'page' : undefined}
                aria-label={t(item.label)}
                title={t(item.label)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(item.label)}</span>
                {currentPage === item.id && <span className="app-nav-indicator" />}
              </button>
            )
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-status">
            <span className={`status-indicator ${connected ? 'is-online' : ''}`} />
            <div>
              <strong>{t(connected ? 'Connected' : 'Disconnected')}</strong>
              <span>{connected ? nameServer : t('No active cluster')}</span>
            </div>
          </div>
          <span className="app-build-label">{t('ROCKETMQ REMOTING · LOCAL')}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className={`app-topbar ${isDesktop ? 'has-window-controls' : ''}`} data-tauri-drag-region onDoubleClick={handleDragRegionDoubleClick}>
          <div className="app-topbar-title" data-tauri-drag-region>
            <span className="app-breadcrumb">ROCKETMQ / {t(pageTitle).toUpperCase()}</span>
            <h2>{t(pageTitle)}</h2>
          </div>
          <div className="app-toolbar">
            <div className="app-connection-form">
              <NameServerCombo
                value={nameServer}
                onChange={setNameServer}
                onSubmit={handleConnect}
                disabled={connected}
                placeholder={t('NameServer Address')}
                ariaLabel={t('NameServer Address')}
              />
              <label className="app-acl-toggle">
                <input type="checkbox" checked={aclEnabled} onChange={(e) => setAclEnabled(e.target.checked)} disabled={connected} />
                <span>ACL</span>
              </label>
              {connected ? (
                <button
                  onClick={handleDisconnect}
                  className="app-button app-button-danger"
                >
                  <Unplug size={15} />
                  {t('Disconnect')}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting || !nameServer}
                  className="app-button app-button-primary"
                >
                  {connecting ? t('Connecting...') : t('Connect')}
                </button>
              )}
            </div>
            <div className="app-toolbar-divider" />
            <div className="app-preference-control" aria-label={t('Language')}>
              <Languages size={15} />
              <button className={language === 'en' ? 'is-selected' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
              <span />
              <button className={language === 'zh-CN' ? 'is-selected' : ''} onClick={() => setLanguage('zh-CN')} aria-pressed={language === 'zh-CN'}>中</button>
            </div>
            <div className="app-theme-control" aria-label={t('Theme')}>
              <button title={t('Dark blue theme')} aria-label={t('Dark blue theme')} aria-pressed={theme === 'dark'} className={theme === 'dark' ? 'is-selected' : ''} onClick={() => setTheme('dark')}><Moon size={16} /></button>
              <button title={t('Light gray theme')} aria-label={t('Light gray theme')} aria-pressed={theme === 'light'} className={theme === 'light' ? 'is-selected' : ''} onClick={() => setTheme('light')}><Sun size={16} /></button>
            </div>
          </div>
          {isDesktop && (
            <div className="app-window-controls">
              <button type="button" onClick={minimizeWindow} title={t('Minimize')} aria-label={t('Minimize')}>
                <Minus size={16} />
              </button>
              <button type="button" onClick={toggleMaximizeWindow} title={t(maximized ? 'Restore' : 'Maximize')} aria-label={t(maximized ? 'Restore' : 'Maximize')}>
                {maximized ? <Copy size={14} /> : <Square size={14} />}
              </button>
              <button type="button" className="is-close" onClick={closeWindow} title={t('Close')} aria-label={t('Close')}>
                <X size={16} />
              </button>
            </div>
          )}
          {aclEnabled && (
            <div className="app-acl-credentials">
              <input type="text" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} disabled={connected} placeholder={t('Access Key')} aria-label={t('Access Key')} className="app-input" />
              <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} disabled={connected} placeholder={t('Secret Key')} aria-label={t('Secret Key')} className="app-input" />
              <span>{t('Requests are signed with HMAC-SHA1')}</span>
            </div>
          )}
          {error && <div className="app-connect-error">{displayError(error)}</div>}
        </header>

        <main className="app-content">
          {visitedPages.includes('dashboard') && (
            <PageSlot active={currentPage === 'dashboard'}>
              <DashboardPage connected={connected} active={currentPage === 'dashboard'} />
            </PageSlot>
          )}

          {visitedPages.includes('topics') && (
            <PageSlot active={currentPage === 'topics'}>
              <TopicsPage connected={connected} />
            </PageSlot>
          )}

          {visitedPages.includes('consumers') && (
            <PageSlot active={currentPage === 'consumers'}>
              <ConsumersPage connected={connected} active={currentPage === 'consumers'} />
            </PageSlot>
          )}

          {visitedPages.includes('producers') && (
            <PageSlot active={currentPage === 'producers'}>
              <ProducerPage connected={connected} />
            </PageSlot>
          )}

          {visitedPages.includes('messages') && (
            <PageSlot active={currentPage === 'messages'}>
              <MessagePage
                connected={connected}
                active={currentPage === 'messages'}
                onViewTrace={(msgId) => {
                  setTraceTarget(msgId)
                  setCurrentPage('trace')
                }}
              />
            </PageSlot>
          )}

          {visitedPages.includes('trace') && (
            <PageSlot active={currentPage === 'trace'}>
              <TracePage connected={connected} initialMsgId={traceTarget} />
            </PageSlot>
          )}

          {visitedPages.includes('cluster') && (
            <PageSlot active={currentPage === 'cluster'}>
              <ClusterPage connected={connected} />
            </PageSlot>
          )}

          {visitedPages.includes('acl') && (
            <PageSlot active={currentPage === 'acl'}>
              <AclPage connected={connected} />
            </PageSlot>
          )}

          {visitedPages.includes('ops') && (
            <PageSlot active={currentPage === 'ops'}>
              <OpsPage
                connected={connected}
                connecting={connecting}
                currentNameServer={nameServer}
                onConnect={(profile: ClusterProfile) =>
                  connectTo(
                    profile.nameServer,
                    profile.aclEnabled,
                    profile.accessKey,
                    profile.secretKey
                  )
                }
                onDisconnect={handleDisconnect}
              />
            </PageSlot>
          )}
        </main>
      </div>
    </div>
  )
}

export default App

