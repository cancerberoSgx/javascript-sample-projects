import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onSelect?: () => void
  shortcut?: string
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', onClose, true)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const estimatedHeight = items.length * 36 + 12
  const left = Math.max(8, Math.min(x, window.innerWidth - 228))
  const top = Math.max(
    8,
    Math.min(y, window.innerHeight - estimatedHeight),
  )

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
      style={{ left, top }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onSelect?.()
            onClose()
          }}
          className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
            item.danger
              ? 'text-rose-600 hover:bg-rose-50'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-slate-400">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  )
}
