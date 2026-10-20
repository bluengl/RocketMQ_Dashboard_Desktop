import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { MessageSquare, Search, RefreshCw, KeyRound, Clock, GitBranch } from 'lucide-react'
import type { MessageInfo } from './types'
import { errorMessage } from './utils/errors'
import Pagination from './components/Pagination'
import ErrorNotice from './components/ErrorNotice'
import { usePagination } from './hooks/usePagination'

interface MessagePageProps {
  connected: boolean
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

function formatTimestamp(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

export default function MessagePage({ connected, onViewTrace }: MessagePageProps) {
  const [msgId, setMsgId] = useState('')
  const [topic, setTopic] = useState('')
  const [key, setKey] = useState('')
  const [beginTime, setBeginTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [timeTopic, setTimeTopic] = useState('')
  const [messages, setMessages] = useState<MessageInfo[]>([])
  const [selected, setSelected] = useState<MessageInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasQueried, setHasQueried] = useState(false)
  const messagePager = usePagination(messages, 20)

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
    if (!topic.trim() || !key.trim()) return
    setLoading(true)
    setHasQueried(true)
    setError(null)
    try {
      const result = await invoke<MessageInfo[]>('query_message_by_key', {
        topic: topic.trim(),
        key: key.trim(),
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
          <h1 className="text-2xl font-semibold text-slate-50">Messages</h1>
          <p className="text-sm text-slate-400">Query messages by ID or Topic + Key</p>
        </div>
      </div>

      {/* Query forms */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Search className="w-4 h-4 text-cyan-400" />
            Query by Message ID
          </div>
          <input
            type="text"
            value={msgId}
            onChange={(e) => setMsgId(e.target.value)}
            placeholder="Message ID (32 hex chars)"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
          />
          <button
            onClick={searchById}
            disabled={!connected || loading || !msgId.trim()}
            className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <KeyRound className="w-4 h-4 text-orange-400" />
            Query by Topic + Key
          </div>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Message Key"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={searchByKey}
            disabled={!connected || loading || !topic.trim() || !key.trim()}
            className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Clock className="w-4 h-4 text-green-400" />
            Query by Time Range
          </div>
          <input
            type="text"
            value={timeTopic}
            onChange={(e) => setTimeTopic(e.target.value)}
            placeholder="Topic"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="datetime-local"
            value={beginTime}
            onChange={(e) => setBeginTime(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={searchByTime}
            disabled={!connected || loading || !timeTopic.trim() || !beginTime || !endTime}
            className="w-full px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>

      {error && <ErrorNotice error={error} />}

      {!connected ? (
        <div className="text-center py-12 text-slate-400">Please connect to RocketMQ to query messages</div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Querying messages...
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {hasQueried ? 'No messages found' : 'Enter a Message ID, or a Topic + Key, to search'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Message list */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 text-sm font-medium text-slate-300">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
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
                  <div className="text-sm font-medium text-slate-100 truncate">{m.msgId ?? 'N/A'}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {m.topic} · offset {m.queueOffset ?? '-'}
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
                  <h3 className="font-medium text-slate-200">Message Detail</h3>
                  {onViewTrace && selected.msgId && (
                    <button
                      onClick={() => onViewTrace(selected.msgId!)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm rounded-lg transition-colors"
                    >
                      <GitBranch className="w-4 h-4 text-cyan-400" />
                      View Trace
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Detail label="Topic" value={selected.topic} />
                  <Detail label="Msg ID" value={selected.msgId} mono />
                  <Detail label="Queue" value={selected.queueId?.toString()} />
                  <Detail label="Queue Offset" value={selected.queueOffset?.toString()} />
                  <Detail label="Born Timestamp" value={formatTimestamp(selected.bornTimestamp)} />
                  <Detail label="Store Timestamp" value={formatTimestamp(selected.storeTimestamp)} />
                  <Detail label="Born Host" value={selected.bornHost} />
                  <Detail label="Store Host" value={selected.storeHost} />
                  <Detail label="Reconsume Times" value={selected.reconsumeTimes?.toString()} />
                  <Detail label="Tags" value={selected.properties?.TAGS} />
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Keys</div>
                  <div className="text-sm text-slate-100">{selected.properties?.KEYS ?? '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Body</div>
                  <pre className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 whitespace-pre-wrap break-all max-h-64 overflow-auto">
                    {decodeBody(selected.body) || '(empty body)'}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">Select a message to view details</div>
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
