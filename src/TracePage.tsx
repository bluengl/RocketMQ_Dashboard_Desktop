import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { CheckCircle2, GitBranch, RefreshCw, Search, Send, Inbox, XCircle } from 'lucide-react'
import type { ConsumerStatus, TraceNode, TraceRecord } from './types'
import { errorMessage } from './utils/errors'
import ErrorNotice from './components/ErrorNotice'
import { useI18n } from './i18n'

interface TracePageProps {
  connected: boolean
  initialMsgId?: string | null
}

type TraceMode = 'msgid' | 'key'

function formatTime(ts: number | undefined, locale: string): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString(locale)
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '-'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function nodeIcon(title: string) {
  if (title === 'produce') return Send
  if (title === 'consume') return Inbox
  return GitBranch
}

function statusBadge(status: string) {
  if (status === 'finish' || status === 'success') {
    return 'bg-green-500/10 text-green-400'
  }
  if (status === 'failed') {
    return 'bg-red-500/10 text-red-400'
  }
  return 'bg-slate-500/10 text-slate-400'
}

function deliveryLabel(status: string): string {
  if (status === 'success') return 'Success'
  if (status === 'failed') return 'Failed'
  return 'Pending'
}

function traceLabel(value: string): string {
  const labels: Record<string, string> = {
    produce: 'Produce',
    consume: 'Consume',
    finish: 'Finished',
    success: 'Success',
    failed: 'Failed',
    pending: 'Pending',
  }
  return labels[value.toLowerCase()] ?? value
}

export default function TracePage({ connected, initialMsgId }: TracePageProps) {
  const { t, language } = useI18n()
  const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US'
  const [mode, setMode] = useState<TraceMode>('msgid')
  const [queryValue, setQueryValue] = useState('')
  const [traceTopic, setTraceTopic] = useState('')
  const [record, setRecord] = useState<TraceRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasQueried, setHasQueried] = useState(false)

  const runQuery = async (value = queryValue, queryMode = mode) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setHasQueried(true)
    try {
      const traceTopicArg = traceTopic.trim() || null
      const result =
        queryMode === 'key'
          ? await invoke<TraceRecord>('query_message_trace_by_key', {
              key: trimmed,
              traceTopic: traceTopicArg,
            })
          : await invoke<TraceRecord>('query_message_trace', {
              msgId: trimmed,
              traceTopic: traceTopicArg,
            })
      setRecord(result)
    } catch (err) {
      setRecord(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialMsgId) return
    setMode('msgid')
    setQueryValue(initialMsgId)
    if (connected) {
      void runQuery(initialMsgId, 'msgid')
    }
    // Only react to a new message id handed over from the message page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMsgId])

  const nodes = record?.nodes ?? []
  const consumerStatus = record?.consumerStatus ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <GitBranch className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">{t('Message Trace')}</h1>
          <p className="text-sm text-slate-400">
            {t('Query the produce / store / consume chain by message ID or key')}
          </p>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 trace-query-panel">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {(['msgid', 'key'] as TraceMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 text-sm transition-colors ${
                  mode === m
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-100'
                }`}
              >
                {m === 'msgid' ? t('Message ID') : t('Message Key')}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runQuery()
            }}
            placeholder={mode === 'key' ? t('Message key') : t('Message ID (32 hex chars)')}
            className="flex-1 min-w-[280px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
          />
          <input
            type="text"
            value={traceTopic}
            onChange={(e) => setTraceTopic(e.target.value)}
            placeholder={t('Trace topic (default RMQ_SYS_TRACE_TOPIC)')}
            className="w-72 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
          />
          <button
            onClick={() => void runQuery()}
            disabled={!connected || loading || !queryValue.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" />
            {t('Search')}
          </button>
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">{t('Please connect to RocketMQ to query traces')}</div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          {t('Loading trace...')}
        </div>
      ) : !hasQueried ? (
        <div className="text-center py-12 text-slate-400">
          {t('Enter a message ID or key to view its trace chain')}
        </div>
      ) : nodes.length === 0 && consumerStatus.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {t('No trace data found. Ensure message trace is enabled on the broker (traceTopicEnable=true).')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 trace-results-grid">
          <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium text-slate-200">{t('Trace Timeline')}</h3>
              <span className="text-xs text-slate-400">{nodes.length} {t('node(s)')}</span>
            </div>
            {nodes.length === 0 ? (
              <div className="text-sm text-slate-400">{t('No produce / consume nodes in the trace')}</div>
            ) : (
              <ol className="relative border-l border-slate-700 ml-2 space-y-6">
                {nodes.map((node: TraceNode, index) => {
                  const Icon = nodeIcon(node.title)
                  return (
                    <li key={index} className="ml-6">
                      <span className="absolute -left-[13px] flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 border border-slate-700">
                        <Icon
                          className={`w-3.5 h-3.5 ${
                            node.status === 'failed' ? 'text-red-400' : 'text-cyan-400'
                          }`}
                        />
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-100 capitalize">{t(traceLabel(node.title))}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(node.status)}`}>
                          {t(traceLabel(node.status))}
                        </span>
                        <span className="text-xs text-slate-500">{formatDuration(node.costTime)}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 font-mono">{formatTime(node.timestamp, locale)}</div>
                      <div className="text-sm text-slate-300 mt-1 break-all">{node.description}</div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden self-start">
            <div className="px-5 py-4 border-b border-slate-700 text-sm font-medium text-slate-300">
              {t('Consumer Status')} ({consumerStatus.length})
            </div>
            {consumerStatus.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400">{t('No consumer records')}</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {consumerStatus.map((c: ConsumerStatus, index) => (
                  <div key={index} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {c.deliveryStatus === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : c.deliveryStatus === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm font-mono text-slate-100 break-all">{c.group}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className={statusBadge(c.deliveryStatus) + ' px-2 py-0.5 rounded font-medium'}>
                        {t(deliveryLabel(c.deliveryStatus))}
                      </span>
                      <span className="font-mono">{formatTime(c.consumeTime, locale)}</span>
                    </div>
                    {c.retryCount > 0 && (
                      <div className="text-xs text-red-400">{t('Retry count: {count}', { count: c.retryCount })}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
