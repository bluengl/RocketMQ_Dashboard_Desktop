import { AlertCircle, Braces, WifiOff } from 'lucide-react'
import { describeError, type ErrorKind } from '../utils/errors'

const STYLES: Record<ErrorKind, { box: string; icon: typeof AlertCircle }> = {
  connection: { box: 'bg-red-500/10 border-red-500/20 text-red-400', icon: WifiOff },
  protocol: { box: 'bg-amber-500/10 border-amber-500/20 text-amber-300', icon: AlertCircle },
  data: { box: 'bg-purple-500/10 border-purple-500/20 text-purple-300', icon: Braces },
  unknown: { box: 'bg-slate-700/40 border-slate-600 text-slate-300', icon: AlertCircle },
}

interface ErrorNoticeProps {
  error: unknown
  compact?: boolean
}

export default function ErrorNotice({ error, compact = false }: ErrorNoticeProps) {
  if (!error) return null

  const info = describeError(error)
  const style = STYLES[info.kind]
  const Icon = style.icon

  return (
    <div
      className={`${style.box} border rounded-lg flex items-center gap-2 ${
        compact ? 'px-3 py-2 text-sm' : 'p-4'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-black/20">
        {info.label}
      </span>
      <span className="break-all">{info.message}</span>
    </div>
  )
}
