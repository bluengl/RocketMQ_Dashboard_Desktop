import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { MessageSquare, Search, RefreshCw, KeyRound, Clock, GitBranch } from 'lucide-react'
import type { MessageInfo } from './types'
import { errorMessage } from './utils/errors'
import Pagination from './components/Pagination'
import ErrorNotice from './components/ErrorNotice'
import DateTimePicker from './components/DateTimePicker'
import ComboBox from './components/ComboBox'
import { filterUserTopics } from './utils/topics'
import { usePagination } from './hooks/usePagination'
import { useI18n } from './i18n'

interface MessagePageProps {
  connected: boolean
  active?: boolean
  onViewTrace?: (msgId: string) => void
}

function decodeBody(body?: string): string {
  if (!body) return ''
  try {
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return body
  }
}

function formatTimestamp(ts: number | undefined, locale: string): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString(locale)
}

export default function MessagePage({ connected, active = true, onViewTrace }: MessagePageProps) {
  const { t, language } = useI18n()
  const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US'
  const [msgId, setMsgId] = useState('')
  const [topic, setTopic] = useState('')
  const [key, setKey] = useState('')
  const [beginTime, setBeginTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [timeTopic, setTimeTopic] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [messages, setMessages] = useState<MessageInfo[]>([])
  const [selected, setSelected] = useState<MessageInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasQueried, setHasQueried] = useState(false)
  const messagePager = usePagination(messages, 20)

  useEffect(() => {
    if (!connected) {
      setTopics([])
      return
    }
    if (!active) return
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
  }, [connected, active])

  const searchById = async () => {
    if (!msgId.trim()) return
    setLoading(true)
    setHasQueried(true)
    setError(null)
    try {
      const result = await invoke<MessageInfo[]>('query_message_by_id', { msgId: msgId.trim() })
      setMessages(result)
      setSelected(result[0] ?? null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const searchByKey = async () => {
    if (!topic.trim()) return
    setLoading(true)
    setHasQueried(true)
    setError(null)
    try {
      const trimmedKey = key.trim()
      // Without a key, list the topic's recent messages instead of requiring one.
      const result = trimmedKey
        ? await invoke<MessageInfo[]>('query_message_by_key', {
            topic: topic.trim(),
            key: trimmedKey,
          })
        : await invoke<MessageInfo[]>('query_message_by_time', {
            topic: topic.trim(),
            beginTs: Date.now() - 24 * 60 * 60 * 1000,
            endTs: Date.now(),
          })
      setMessages(result)
      setSelected(result[0] ?? null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const searchByTime = async () => {
    if (!timeTopic.trim() || !beginTime || !endTime) return
    setLoading(true)
    setHasQueried(true)
    setError(null)
    try {
      const result = await invoke<MessageInfo[]>('query_message_by_time', {
        topic: timeTopic.trim(),
        beginTs: new Date(beginTime).getTime(),
        endTs: new Date(endTime).getTime(),
      })
      setMessages(result)
      setSelected(result[0] ?? null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <MessageSquare className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">{t('Messages')}</h1>
          <p className="text-sm text-slate-400">{t('Query messages by ID or Topic + Key')}</p>
        </div>
      </div>

      {/* Query forms */}
      <div className="grid grid-cols-3 gap-4 message-query-grid">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Search className="w-4 h-4 text-cyan-400" />
            {t('Query by Message ID')}
          </div>
          <input
            type="text"
            value={msgId}
            onChange={(e) => setMsgId(e.target.value)}
            placeholder={t('Message ID (32 hex chars)')}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
          />
          <button
            onClick={searchById}
            disabled={!connected || loading || !msgId.trim()}
            className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('Search')}
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <KeyRound className="w-4 h-4 text-orange-400" />
            {t('Query by Topic + Key')}
          </div>
          <ComboBox
            value={topic}
            options={topics}
            onChange={setTopic}
            placeholder={t('Topic')}
            ariaLabel={t('Topic')}
            emptyLabel={t('No matching topics')}
          />
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('Message Key (optional)')}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={searchByKey}
            disabled={!connected || loading || !topic.trim()}
            className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('Search')}
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Clock className="w-4 h-4 text-green-400" />
            {t('Query by Time Range')}
          </div>
          <ComboBox
            value={timeTopic}
            options={topics}
            onChange={setTimeTopic}
            placeholder={t('Topic')}
            ariaLabel={t('Topic')}
            emptyLabel={t('No matching topics')}
          />
          <DateTimePicker
            value={beginTime}
            onChange={setBeginTime}
            placeholder={t('Start time')}
            ariaLabel={t('Start time')}
          />
          <DateTimePicker
            value={endTime}
            onChange={setEndTime}
            placeholder={t('End time')}
            ariaLabel={t('End time')}
          />
          <button
            onClick={searchByTime}
            disabled={!connected || loading || !timeTopic.trim() || !beginTime || !endTime}
            className="w-full px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('Search')}
          </button>
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">{t('Please connect to RocketMQ to query messages')}</div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          {t('Querying messages...')}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {hasQueried ? t('No messages found') : t('Enter a Message ID, or a Topic + Key, to search')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 message-results-grid">
          {/* Message list */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 text-sm font-medium text-slate-300">
              {messages.length} {t(messages.length === 1 ? 'message' : 'messages')}
            </div>
            <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
              {messagePager.pageItems.map((m, i) => (
                <button
                  key={m.msgId ?? i}
                  onClick={() => setSelected(m)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-700/40 transition-colors ${
                    selected?.msgId === m.msgId ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-slate-100 truncate">{m.msgId ?? t('N/A')}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {m.topic} · {t('Offset')} {m.queueOffset ?? '-'}
                  </div>
                </button>
              ))}
            </div>
            <Pagination
              page={messagePager.page}
              pageSize={messagePager.pageSize}
              total={messagePager.total}
              totalPages={messagePager.totalPages}
              onPageChange={messagePager.setPage}
              onPageSizeChange={messagePager.setPageSize}
            />
          </div>

          {/* Message detail */}
          <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-200">{t('Message Detail')}</h3>
                  {onViewTrace && selected.msgId && (
                    <button
                      onClick={() => onViewTrace(selected.msgId!)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm rounded-lg transition-colors"
                    >
                      <GitBranch className="w-4 h-4 text-cyan-400" />
                      {t('View Trace')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm message-detail-grid">
                  <Detail label={t('Topic')} value={selected.topic} />
                  <Detail label={t('Msg ID')} value={selected.msgId} mono />
                  <Detail label={t('Queue')} value={selected.queueId?.toString()} />
                  <Detail label={t('Queue Offset')} value={selected.queueOffset?.toString()} />
                  <Detail label={t('Born Timestamp')} value={formatTimestamp(selected.bornTimestamp, locale)} />
                  <Detail label={t('Store Timestamp')} value={formatTimestamp(selected.storeTimestamp, locale)} />
                  <Detail label={t('Born Host')} value={selected.bornHost} />
                  <Detail label={t('Store Host')} value={selected.storeHost} />
                  <Detail label={t('Reconsume Times')} value={selected.reconsumeTimes?.toString()} />
                  <Detail label={t('Tags')} value={selected.properties?.TAGS} />
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">{t('Keys')}</div>
                  <div className="text-sm text-slate-100">{selected.properties?.KEYS ?? '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">{t('Body')}</div>
                  <pre className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 whitespace-pre-wrap break-all max-h-64 overflow-auto">
                    {decodeBody(selected.body) || t('(empty body)')}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">{t('Select a message to view details')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-sm text-slate-200 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value ?? '-'}
      </div>
    </div>
  )
}
