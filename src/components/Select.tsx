import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  compact?: boolean
  inline?: boolean
  ariaLabel?: string
  searchable?: boolean
  searchPlaceholder?: string
  emptyLabel?: string
}

interface MenuPosition {
  top?: number
  bottom?: number
  left: number
  minWidth: number
  maxWidth: number
}

const MENU_GAP = 6
const MENU_MAX_HEIGHT = 280

export default function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  compact = false,
  inline = false,
  ariaLabel,
  searchable = false,
  searchPlaceholder,
  emptyLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const normalizedQuery = query.trim().toLowerCase()
  const visibleOptions =
    searchable && normalizedQuery
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(normalizedQuery) ||
            option.value.toLowerCase().includes(normalizedQuery)
        )
      : options

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < MENU_MAX_HEIGHT && rect.top > spaceBelow
    setPosition({
      top: openAbove ? undefined : rect.bottom + MENU_GAP,
      bottom: openAbove ? window.innerHeight - rect.top + MENU_GAP : undefined,
      left: Math.min(rect.left, Math.max(8, window.innerWidth - 8 - Math.max(rect.width, 220))),
      minWidth: rect.width,
      maxWidth: Math.min(Math.max(rect.width, 240), window.innerWidth - 16),
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
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
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
    setQuery('')
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  useEffect(() => {
    if (!open || !searchable) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, searchable])

  const choose = (option: SelectOption) => {
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) setOpen(false)
      else openMenu()
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions[activeIndex]
      if (option) choose(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const menu = open && position && (
    <div
      ref={menuRef}
      className="app-select-menu"
      role="listbox"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        minWidth: position.minWidth,
        maxWidth: position.maxWidth,
      }}
      onKeyDown={onMenuKeyDown}
    >
      {searchable && (
        <div className="app-select-search">
          <Search size={13} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onMenuKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      {visibleOptions.length === 0 ? (
        <div className="app-select-empty">{emptyLabel ?? '—'}</div>
      ) : (
        visibleOptions.map((option, index) => (
          <button
            type="button"
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            className={`app-select-option ${option.value === value ? 'is-selected' : ''} ${
              index === activeIndex ? 'is-active' : ''
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <span className="app-select-option-label">{option.label}</span>
            {option.value === value && <Check size={14} />}
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className={`app-select ${compact ? 'is-compact' : ''} ${inline ? 'is-inline' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="app-select-trigger"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`app-select-value ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.label : (placeholder ?? '')}
        </span>
        <ChevronDown size={14} className="app-select-chevron" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
