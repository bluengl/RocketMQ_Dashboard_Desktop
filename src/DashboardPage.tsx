import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Activity, RefreshCw } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardMetrics, TpsSample } from './types/broker'
import { errorMessage } from './utils/errors'
import ErrorNotice from './components/ErrorNotice'
import './styles/monitor.css'

const POLL_INTERVAL_MS = 5000
const MAX_SAMPLES = 60

const SERIES = [
  { key: 'putTps' as const, name: 'Produce TPS', color: '#3987e5' },
  { key: 'getTps' as const, name: 'Consume TPS', color: '#d95926' },
]

interface DashboardPageProps {
  connected: boolean
}

interface TooltipItem {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
}

function formatNumber(value: number, digits = 1) {
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function formatClock(time: number) {
  return new Date(time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function compactTick(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  if (value >= 10) return String(Math.round(value))
  return String(value)
}

function TpsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: number | string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rmq-tooltip">
      <div className="rmq-tooltip-time">
        {typeof label === 'number' ? formatClock(label) : label}
      </div>
      {payload.map((item) => (
        <div className="rmq-tooltip-row" key={String(item.dataKey)}>
          <span className="rmq-tooltip-key" style={{ background: item.color }} />
          <span className="rmq-tooltip-value">
            {formatNumber(Number(item.value ?? 0))}
          </span>
          <span className="rmq-tooltip-label">{item.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage({ connected }: DashboardPageProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [history, setHistory] = useState<TpsSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTable, setShowTable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoke<DashboardMetrics>('get_dashboard_metrics')
      setMetrics(result)
      setError(null)
      setHistory((prev) =>
        [
          ...prev,
          {
            time: result.sampledAt,
            putTps: result.totalPutTps,
            getTps: result.totalGetTps,
          },
        ].slice(-MAX_SAMPLES),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!connected) {
      setMetrics(null)
      setHistory([])
      setError(null)
      return
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [connected, load])

  const latest = history.length > 0 ? history[history.length - 1] : null
  const onlineCount = metrics ? metrics.brokers.filter((b) => b.online).length : 0

  const tableRows = useMemo(() => [...history].reverse(), [history])

  if (!connected) {
    return (
      <div className="rmq-page">
        <div className="rmq-page-header">
          <div>
            <div className="rmq-page-title">Dashboard</div>
            <div className="rmq-page-subtitle">Cluster overview and live message throughput</div>
          </div>
        </div>
        <div className="rmq-card">
          <div className="rmq-empty">
            <Activity size={40} style={{ opacity: 0.4 }} />
            <span>Connect to RocketMQ to view live metrics</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rmq-page">
      <div className="rmq-page-header">
        <div>
          <div className="rmq-page-title">Dashboard</div>
          <div className="rmq-page-subtitle">
            Live metrics from broker runtime info · sampled every {POLL_INTERVAL_MS / 1000}s
            {metrics && ` · last sample ${formatClock(metrics.sampledAt)}`}
          </div>
        </div>
        <div className="rmq-header-actions">
          <button className="rmq-btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'rmq-spin' : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      <div className="rmq-kpi-row">
        <div className="rmq-tile">
          <div className="rmq-tile-label">Brokers</div>
          <div className="rmq-tile-value">
            {metrics ? metrics.brokers.length : '—'}
            <span className="rmq-tile-unit">total</span>
          </div>
          <div className="rmq-tile-hint">{onlineCount} online</div>
        </div>
        <div className="rmq-tile">
          <div className="rmq-tile-label">Topics</div>
          <div className="rmq-tile-value">{metrics ? formatNumber(metrics.totalTopics, 0) : '—'}</div>
        </div>
        <div className="rmq-tile">
          <div className="rmq-tile-label">Consumer groups</div>
          <div className="rmq-tile-value">{metrics ? formatNumber(metrics.totalGroups, 0) : '—'}</div>
        </div>
        <div className="rmq-tile">
          <div className="rmq-tile-label">Produce TPS</div>
          <div className="rmq-tile-value">
            {metrics ? formatNumber(metrics.totalPutTps) : '—'}
            <span className="rmq-tile-unit">msg/s</span>
          </div>
        </div>
        <div className="rmq-tile">
          <div className="rmq-tile-label">Consume TPS</div>
          <div className="rmq-tile-value">
            {metrics ? formatNumber(metrics.totalGetTps) : '—'}
            <span className="rmq-tile-unit">msg/s</span>
          </div>
        </div>
      </div>

      <div className="rmq-card">
        <div className="rmq-card-header">
          <div>
            <div className="rmq-card-title">Message throughput</div>
            <div className="rmq-card-meta">
              {history.length > 1
                ? `Last ${history.length} samples · ${formatClock(history[0].time)} – ${formatClock(history[history.length - 1].time)}`
                : 'Collecting samples…'}
            </div>
          </div>
          <button className="rmq-btn" onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Chart view' : 'Table view'}
          </button>
        </div>

        <div className="rmq-chart-legend">
          {SERIES.map((series) => (
            <span className="rmq-legend-item" key={series.key}>
              <span className="rmq-legend-key" style={{ background: series.color }} />
              {series.name}
              <span className="rmq-legend-value">
                {latest ? formatNumber(latest[series.key]) : '—'}
              </span>
            </span>
          ))}
        </div>

        {showTable ? (
          <div className="rmq-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="rmq-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Produce TPS</th>
                  <th>Consume TPS</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td className="rmq-empty-row" colSpan={3}>
                      No samples yet
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => (
                    <tr key={row.time}>
                      <td className="rmq-num">{formatClock(row.time)}</td>
                      <td className="rmq-num">{formatNumber(row.putTps)}</td>
                      <td className="rmq-num">{formatNumber(row.getTps)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : history.length < 2 ? (
          <div className="rmq-empty">
            <span>Waiting for the next sample to draw the trend…</span>
          </div>
        ) : (
          <div className="rmq-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 8, right: 18, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#334155" strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={formatClock}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  minTickGap={48}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tickFormatter={compactTick}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip
                  cursor={{ stroke: '#475569', strokeWidth: 1 }}
                  content={<TpsTooltip />}
                  isAnimationActive={false}
                />
                {SERIES.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.name}
                    stroke={series.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={{ r: 4, stroke: '#1e293b', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!metrics || metrics.brokers.length === 0 ? (
                <tr>
                  <td className="rmq-empty-row" colSpan={8}>
                    No broker metrics available
                  </td>
                </tr>
              ) : (
                metrics.brokers.map((broker) => (
                  <tr key={broker.brokerAddr}>
                    <td>{broker.brokerName}</td>
                    <td>{broker.cluster}</td>
                    <td className="rmq-mono">{broker.brokerAddr}</td>
                    <td>{broker.version}</td>
                    <td>{broker.uptime}</td>
                    <td className="rmq-num">{formatNumber(broker.putTps)}</td>
                    <td className="rmq-num">{formatNumber(broker.getTps)}</td>
                    <td title={broker.error ?? undefined}>
                      {broker.online ? (
                        <span className="rmq-badge rmq-badge-online">Online</span>
                      ) : (
                        <span className="rmq-badge rmq-badge-error">
                          {broker.error ? 'Unavailable' : 'Offline'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
