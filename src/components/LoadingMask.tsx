import { RefreshCw } from 'lucide-react'

interface LoadingMaskProps {
  active: boolean
}

// Overlays the current content instead of replacing it, so refreshes do not flash.
export default function LoadingMask({ active }: LoadingMaskProps) {
  if (!active) return null
  return (
    <div className="rmq-loading-mask" role="status" aria-live="polite">
      <RefreshCw className="rmq-spin" size={20} />
    </div>
  )
}
