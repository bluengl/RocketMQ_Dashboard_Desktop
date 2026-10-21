import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

interface ComboBoxProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
  emptyLabel?: string
  onSubmit?: (value?: string) => void
  submitOnSelect?: boolean
}

interface MenuPosition {
  top?: number
  bottom?: number
  left: number
  minWidth: number
  maxWidth: number
}

const MENU_GAP = 6
const MENU_MAX_HEIGHT = 260

// Editable input with a filtered suggestion list.
export default function ComboBox({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
  emptyLabel,
  onSubmit,
  submitOnSelect = false,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const normalized = value.trim().toLowerCase()
  const visibleOptions =
    typing && normalized
      ? options.filter((option) => option.toLowerCase().includes(normalized))
      : options

  const updatePosition = () => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (!rect) return
    const openAbove = window.innerHeight - rect.bottom < MENU_MAX_HEIGHT && rect.top > MENU_MAX_HEIGHT
    setPosition({
      top: openAbove ? undefined : rect.bottom + MENU_GAP,
      bottom: openAbove ? window.innerHeight - rect.top + MENU_GAP : undefined,
      left: Math.min(rect.left, Math.max(8, window.innerWidth - 8 - Math.max(rect.width, 240))),
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
      // The wrapper holds both the input and the chevron toggle; without it the
      // toggle press would close the menu on mousedown and reopen on click.
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
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

  const suppressOpenRef = useRef(false)

  const openMenu = () => {
    if (disabled || suppressOpenRef.current) return
    setTyping(false)
    setActiveIndex(-1)
    setOpen(true)
  }

  const choose = (option: string) => {
    // Returning focus to the input re-fires onFocus; suppress that reopen.
    suppressOpenRef.current = true
    onChange(option)
    setTyping(false)
    setOpen(false)
    inputRef.current?.focus()
    requestAnimationFrame(() => {
      suppressOpenRef.current = false
    })
    if (submitOnSelect) onSubmit?.(option)
  }

  const onInputKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        openMenu()
        return
      }
      setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && visibleOptions[activeIndex]) {
        event.preventDefault()
        choose(visibleOptions[activeIndex])
      } else {
        setOpen(false)
        onSubmit?.()
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const menu = open && position && createPortal(
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
    >
      {visibleOptions.length === 0 ? (
        <div className="app-select-empty">{emptyLabel ?? '—'}</div>
      ) : (
        visibleOptions.map((option, index) => (
          <button
            type="button"
            key={option}
            role="option"
            aria-selected={option === value}
            className={`app-select-option ${option === value ? 'is-selected' : ''} ${
              index === activeIndex ? 'is-active' : ''
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <span className="app-select-option-label">{option}</span>
          </button>
        ))
      )}
    </div>,
    document.body
  )

  return (
    <div className="app-combo" ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setTyping(true)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={openMenu}
        onClick={() => {
          if (!open) openMenu()
        }}
        onKeyDown={onInputKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="app-input app-combo-input"
      />
      <button
        type="button"
        className="app-combo-toggle"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={disabled}
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <ChevronDown size={14} className="app-combo-chevron" />
      </button>
      {menu}
    </div>
  )
}
