import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { loadNameServerHistory, removeNameServerHistory } from '../utils/nameServerHistory'

interface NameServerComboProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}

export default function NameServerCombo({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder,
  ariaLabel,
}: NameServerComboProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  const openMenu = () => {
    if (disabled) return
    setHistory(loadNameServerHistory())
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (address: string) => {
    onChange(address)
    setOpen(false)
  }

  const handleRemove = (address: string) => {
    setHistory(removeNameServerHistory(address))
  }

  return (
    <div className="app-ns-combo" ref={rootRef}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={openMenu}
        onClick={() => {
          if (!open) openMenu()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            setOpen(false)
            onSubmit?.()
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="app-input app-nameserver-input"
      />
      <button
        type="button"
        className="app-ns-combo-toggle"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        tabIndex={-1}
        aria-label={t('Show saved NameServers')}
        title={t('Show saved NameServers')}
        aria-expanded={open}
      >
        <ChevronDown size={14} className="app-ns-combo-chevron" />
      </button>
      {open && history.length > 0 && (
        <div className="app-ns-combo-menu" role="listbox" aria-label={t('Recent connections')}>
          <div className="app-ns-combo-heading">{t('Recent connections')}</div>
          {history.map((address) => (
            <div
              key={address}
              className={`app-ns-combo-item ${address === value ? 'is-current' : ''}`}
              role="option"
              aria-selected={address === value}
            >
              <button type="button" className="app-ns-combo-option" onClick={() => choose(address)}>
                {address}
              </button>
              <button
                type="button"
                className="app-ns-combo-remove"
                title={t('Remove from history')}
                aria-label={t('Remove from history')}
                onClick={() => handleRemove(address)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
