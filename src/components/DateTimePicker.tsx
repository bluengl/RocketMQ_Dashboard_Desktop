import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../i18n'

interface DateTimePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}

interface MenuPosition {
  top?: number
  bottom?: number
  left: number
}

const MENU_GAP = 6
const MENU_HEIGHT = 380

const pad = (value: number) => String(value).padStart(2, '0')

function toInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseValue(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function sameDay(a: Date, year: number, month: number, day: number): boolean {
  return a.getFullYear() === year && a.getMonth() === month && a.getDate() === day
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
}: DateTimePickerProps) {
  const { t, language } = useI18n()
  const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US'
  const selected = parseValue(value)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [view, setView] = useState(() => {
    const base = selected ?? new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const monthFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' })
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })

  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(2024, 0, 7 + index))
  )

  const today = new Date()
  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const openAbove = window.innerHeight - rect.bottom < MENU_HEIGHT && rect.top > MENU_HEIGHT
    setPosition({
      top: openAbove ? undefined : rect.bottom + MENU_GAP,
      bottom: openAbove ? window.innerHeight - rect.top + MENU_GAP : undefined,
      left: Math.min(rect.left, Math.max(8, window.innerWidth - 8 - 320)),
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
    const handle = () => updatePosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
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

  const openMenu = () => {
    if (disabled) return
    const base = selected ?? new Date()
    setView({ year: base.getFullYear(), month: base.getMonth() })
    setOpen(true)
  }

  const commit = (date: Date) => {
    onChange(toInputValue(date))
  }

  const pickDay = (day: number) => {
    const base = selected ?? new Date()
    commit(new Date(view.year, view.month, day, base.getHours(), base.getMinutes()))
  }

  const commitTime = (hours: number, minutes: number) => {
    const base = selected ?? new Date()
    commit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes))
  }

  const shiftMonth = (offset: number) => {
    setView((current) => {
      const next = new Date(current.year, current.month + offset, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const clear = () => {
    onChange('')
    setOpen(false)
  }

  const pickNow = () => {
    const now = new Date()
    commit(now)
    setView({ year: now.getFullYear(), month: now.getMonth() })
  }

  const menu = open && position && (
    <div
      ref={menuRef}
      className="dtp-menu"
      role="dialog"
      aria-label={ariaLabel}
      style={{ top: position.top, bottom: position.bottom, left: position.left }}
    >
      <div className="dtp-head">
        <button type="button" className="dtp-nav" onClick={() => shiftMonth(-1)} aria-label={t('Previous month')}>
          <ChevronLeft size={16} />
        </button>
        <span className="dtp-month">{monthFormatter.format(new Date(view.year, view.month, 1))}</span>
        <button type="button" className="dtp-nav" onClick={() => shiftMonth(1)} aria-label={t('Next month')}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="dtp-weekdays">
        {weekdays.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="dtp-grid">
        {cells.map((day, index) =>
          day === null ? (
            <span key={`blank-${index}`} />
          ) : (
            <button
              type="button"
              key={day}
              className={`dtp-day ${selected && sameDay(selected, view.year, view.month, day) ? 'is-selected' : ''} ${
                sameDay(today, view.year, view.month, day) ? 'is-today' : ''
              }`}
              onClick={() => pickDay(day)}
            >
              {day}
            </button>
          )
        )}
      </div>

      <div className="dtp-time">
        <span>{t('Time')}</span>
        <input
          type="number"
          min={0}
          max={23}
          value={selected ? selected.getHours() : today.getHours()}
          onChange={(event) => {
            const hours = Math.max(0, Math.min(23, Number(event.target.value) || 0))
            commitTime(hours, selected ? selected.getMinutes() : today.getMinutes())
          }}
          aria-label={t('Hours')}
        />
        <span className="dtp-colon">:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={selected ? selected.getMinutes() : today.getMinutes()}
          onChange={(event) => {
            const minutes = Math.max(0, Math.min(59, Number(event.target.value) || 0))
            commitTime(selected ? selected.getHours() : today.getHours(), minutes)
          }}
          aria-label={t('Minutes')}
        />
      </div>

      <div className="dtp-actions">
        <button type="button" className="dtp-action" onClick={clear}>
          {t('Clear')}
        </button>
        <button type="button" className="dtp-action" onClick={pickNow}>
          {t('Now')}
        </button>
        <button type="button" className="dtp-action is-primary" onClick={() => setOpen(false)}>
          {t('Done')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="dtp">
      <button
        ref={triggerRef}
        type="button"
        className="dtp-trigger"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? '' : 'is-placeholder'}>
          {selected ? displayFormatter.format(selected) : (placeholder ?? '')}
        </span>
        <Calendar size={15} className="dtp-icon" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
