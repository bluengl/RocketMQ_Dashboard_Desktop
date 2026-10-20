import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Database, RefreshCw, X } from 'lucide-react'
import type { BrokerInfo, ClusterInfo } from './types'
import './styles/monitor.css'

type RuntimeTable = Record<string, string>

interface BrokerInfoWithRoles extends BrokerInfo {
  master_addr?: string | null
  slave_addrs?: string[] | null
}

interface ClusterPageProps {
  connected: boolean
}

interface SelectedBroker {
  name: string
  addr: string
}

const DETAIL_KEYS: Array<{ key: string; label: string }> = [
  { key: 'brokerVersionDesc', label: 'Version' },
  { key: 'runtime', label: 'Uptime' },
  { key: 'putTps', label: 'Produce TPS' },
  { key: 'getTotalTps', label: 'Consume TPS' },
  { key: 'msgPutTotalTodayNow', label: 'Messages in today' },
  { key: 'msgGetTotalTodayNow', label: 'Messages out today' },
  { key: 'commitLogDirCapacity', label: 'CommitLog capacity' },
  { key: 'putMessageDistributeTime', label: 'Put latency' },
]

function firstNumber(raw: string | undefined) {
  if (!raw) return null
  const first = Number(raw.trim().split(/\s+/)[0])
  return Number.isFinite(first) ? first : null
}

function formatTps(raw: string | undefined) {
  const value = firstNumber(raw)
  return value === null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} msg/s`
}

export default function ClusterPage({ connected }: ClusterPageProps) {
  const [cluster, setCluster] = useState<ClusterInfo | null>(null)
  const [runtimeMap, setRuntimeMap] = useState<Record<string, RuntimeTable>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<SelectedBroker | null>(null)
  const [runtime, setRuntime] = useState<RuntimeTable | null>(null)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [runtimeFilter, setRuntimeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const info = await invoke<ClusterInfo>('get_cluster_info')
      setCluster(info)

      const next: Record<string, RuntimeTable> = {}
      await Promise.all(
        info.brokers.map(async (broker) => {
          const addr = (broker as BrokerInfoWithRoles).master_addr ?? broker.broker_addrs[0]
          if (!addr) return
          try {
            next[broker.broker_name] = await invoke<RuntimeTable>('get_broker_runtime_info', {
              brokerAddr: addr,
            })
          } catch {
            // Broker runtime info is optional enrichment; the table still renders without it.
          }
        }),
      )
      setRuntimeMap(next)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!connected) {
      setCluster(null)
      setRuntimeMap({})
      setError(null)
      setSelected(null)
      return
    }
    load()
  }, [connected, load])

  const clusters = useMemo(() => {
    const grouped = new Map<string, BrokerInfoWithRoles[]>()
    for (const broker of cluster?.brokers ?? []) {
      const entry = broker as BrokerInfoWithRoles
      const list = grouped.get(entry.cluster_name) ?? []
      list.push(entry)
      grouped.set(entry.cluster_name, list)
    }
    return Array.from(grouped.entries())
  }, [cluster])

  const openRuntime = async (broker: BrokerInfoWithRoles) => {
    const addr = broker.master_addr ?? broker.broker_addrs[0]
    if (!addr) return
    setSelected({ name: broker.broker_name, addr })
    setRuntime(runtimeMap[broker.broker_name] ?? null)
    setRuntimeError(null)
    setRuntimeFilter('')

    if (runtimeMap[broker.broker_name]) return

    setRuntimeLoading(true)
    try {
      const table = await invoke<RuntimeTable>('get_broker_runtime_info', { brokerAddr: addr })
      setRuntime(table)
      setRuntimeMap((prev) => ({ ...prev, [broker.broker_name]: table }))
    } catch (err) {
      setRuntimeError(err as string)
    } finally {
      setRuntimeLoading(false)
    }
  }

  useEffect(() => {
    if (!selected) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected])

  const filteredRuntime = useMemo(() => {
    if (!runtime) return []
    const needle = runtimeFilter.trim().toLowerCase()
    return Object.entries(runtime)
      .filter(([key, value]) =>
        needle === ''
          ? true
          : key.toLowerCase().includes(needle) || value.toLowerCase().includes(needle),
      )
      .sort(([a], [b]) => a.localeCompare(b))
  }, [runtime, runtimeFilter])

  return (
    <div className="rmq-page">
      <div className="rmq-page-header">
        <div>
          <div className="rmq-page-title">Cluster</div>
          <div className="rmq-page-subtitle">
            Broker topology and runtime information
            {cluster && ` · ${cluster.brokers.length} brokers · ${clusters.length} clusters`}
          </div>
        </div>
        <div className="rmq-header-actions">
          <button className="rmq-btn" onClick={load} disabled={!connected || loading}>
            <RefreshCw size={15} className={loading ? 'rmq-spin' : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rmq-error">{error}</div>}

      {!connected ? (
        <div className="rmq-card">
          <div className="rmq-empty">
            <Database size={40} style={{ opacity: 0.4 }} />
            <span>Connect to RocketMQ to inspect the cluster</span>
          </div>
        </div>
      ) : loading && !cluster ? (
        <div className="rmq-card">
          <div className="rmq-empty">
            <RefreshCw size={28} className="rmq-spin" />
            <span>Loading cluster topology…</span>
          </div>
        </div>
      ) : (
        <>
          <div className="rmq-card">
            <div className="rmq-card-header">
              <div className="rmq-card-title">Topology</div>
              <div className="rmq-card-meta">Cluster → broker → addresses</div>
            </div>
            <div className="rmq-topology">
              {clusters.length === 0 ? (
                <div className="rmq-empty">No brokers reported by the name server</div>
              ) : (
                clusters.map(([clusterName, brokers]) => (
                  <div className="rmq-cluster-block" key={clusterName}>
                    <div className="rmq-cluster-heading">
                      <Database size={15} />
                      {clusterName}
                      <span className="rmq-cluster-count">{brokers.length} brokers</span>
                    </div>
                    <div className="rmq-broker-grid">
                      {brokers.map((broker) => {
                        const table = runtimeMap[broker.broker_name]
                        const version = table?.brokerVersionDesc ?? broker.version
                        const master = broker.master_addr ?? null
                        const slaves = broker.slave_addrs ?? []
                        const fallbackAddrs =
                          master || slaves.length > 0 ? [] : broker.broker_addrs
                        return (
                          <div className="rmq-broker-node" key={broker.broker_name}>
                            <div className="rmq-broker-node-head">
                              <span className="rmq-broker-node-name">{broker.broker_name}</span>
                              <span
                                className={`rmq-badge ${
                                  broker.online ? 'rmq-badge-online' : 'rmq-badge-offline'
                                }`}
                              >
                                {broker.online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                            {master && (
                              <div className="rmq-addr-row">
                                <span className="rmq-addr-role">master</span>
                                <span className="rmq-mono">{master}</span>
                              </div>
                            )}
                            {slaves.map((addr) => (
                              <div className="rmq-addr-row" key={addr}>
                                <span className="rmq-addr-role">slave</span>
                                <span className="rmq-mono">{addr}</span>
                              </div>
                            ))}
                            {fallbackAddrs.map((addr, index) => (
                              <div className="rmq-addr-row" key={addr}>
                                <span className="rmq-addr-role">addr {index + 1}</span>
                                <span className="rmq-mono">{addr}</span>
                              </div>
                            ))}
                            <div className="rmq-addr-row">
                              <span className="rmq-addr-role">version</span>
                              <span>{version}</span>
                            </div>
                            <div className="rmq-broker-node-actions">
                              <button className="rmq-link-btn" onClick={() => openRuntime(broker)}>
                                View runtime info
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rmq-card">
            <div className="rmq-card-header">
              <div className="rmq-card-title">Brokers</div>
            </div>
            <div className="rmq-table-wrap">
              <table className="rmq-table">
                <thead>
                  <tr>
                    <th>Broker</th>
                    <th>Cluster</th>
                    <th>Address</th>
                    <th>Version</th>
                    <th>Uptime</th>
                    <th>Produce TPS</th>
                    <th>Consume TPS</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(cluster?.brokers ?? []).length === 0 ? (
                    <tr>
                      <td className="rmq-empty-row" colSpan={8}>
                        No brokers available
                      </td>
                    </tr>
                  ) : (
                    (cluster?.brokers ?? []).map((rawBroker) => {
                      const broker = rawBroker as BrokerInfoWithRoles
                      const table = runtimeMap[broker.broker_name]
                      const addr = broker.master_addr ?? broker.broker_addrs[0] ?? '—'
                      return (
                        <tr key={broker.broker_name}>
                          <td>{broker.broker_name}</td>
                          <td>{broker.cluster_name}</td>
                          <td className="rmq-mono">{addr}</td>
                          <td>{table?.brokerVersionDesc ?? broker.version}</td>
                          <td>{table?.runtime ?? '—'}</td>
                          <td className="rmq-num">{formatTps(table?.putTps)}</td>
                          <td className="rmq-num">{formatTps(table?.getTotalTps)}</td>
                          <td>
                            <button className="rmq-link-btn" onClick={() => openRuntime(broker)}>
                              Runtime info
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selected && (
        <div className="rmq-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="rmq-modal" onClick={(event) => event.stopPropagation()}>
            <div className="rmq-modal-header">
              <div>
                <div className="rmq-modal-title">{selected.name}</div>
                <div className="rmq-modal-subtitle rmq-mono">{selected.addr}</div>
              </div>
              <button
                className="rmq-icon-btn"
                onClick={() => setSelected(null)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rmq-modal-body">
              {runtimeError && <div className="rmq-error">{runtimeError}</div>}
              {runtimeLoading ? (
                <div className="rmq-empty">
                  <RefreshCw size={24} className="rmq-spin" />
                  <span>Loading runtime info…</span>
                </div>
              ) : runtime ? (
                <>
                  <div className="rmq-detail-grid">
                    {DETAIL_KEYS.map(({ key, label }) => {
                      const value = runtime[key]
                      if (!value) return null
                      const display =
                        key === 'putTps' || key === 'getTotalTps' ? formatTps(value) : value
                      return (
                        <div className="rmq-detail-cell" key={key}>
                          <div className="rmq-detail-label">{label}</div>
                          <div className="rmq-detail-value">{display}</div>
                        </div>
                      )
                    })}
                  </div>

                  <input
                    className="rmq-search"
                    type="search"
                    placeholder="Filter runtime keys and values…"
                    value={runtimeFilter}
                    onChange={(event) => setRuntimeFilter(event.target.value)}
                  />

                  <div className="rmq-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table className="rmq-table">
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRuntime.length === 0 ? (
                          <tr>
                            <td className="rmq-empty-row" colSpan={2}>
                              No matching entries
                            </td>
                          </tr>
                        ) : (
                          filteredRuntime.map(([key, value]) => (
                            <tr key={key}>
                              <td className="rmq-mono">{key}</td>
                              <td className="rmq-mono">{value}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : !runtimeError ? (
                <div className="rmq-empty">No runtime info available</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
