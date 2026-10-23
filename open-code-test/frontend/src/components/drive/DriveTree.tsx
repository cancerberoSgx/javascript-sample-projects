import { useMemo } from 'react'
import type { DragEvent, MouseEvent } from 'react'

import type { DriveItem } from '../../types'
import { formatBytes } from '../../utils'
import { ChevronIcon, DriveIcon, FileIcon, FolderIcon } from './DriveIcons'

interface DriveTreeProps {
  items: DriveItem[]
  selectedIds: ReadonlySet<number>
  expandedIds: ReadonlySet<number>
  currentFolderId: number | null
  dragOverTarget: number | 'root' | null
  onSelectRoot: () => void
  onSelect: (item: DriveItem, event: MouseEvent<HTMLDivElement>) => void
  onToggle: (item: DriveItem) => void
  onOpenFile: (item: DriveItem) => void
  onContextMenu: (event: MouseEvent, item?: DriveItem) => void
  onDragStart: (event: DragEvent<HTMLDivElement>, item: DriveItem) => void
  onDragOver: (event: DragEvent<HTMLDivElement>, target: number | null) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>, target: number | null) => void
}

function sortItems(items: DriveItem[]): DriveItem[] {
  return [...items].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'folder' ? -1 : 1
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  })
}

export function DriveTree({
  items,
  selectedIds,
  expandedIds,
  currentFolderId,
  dragOverTarget,
  onSelectRoot,
  onSelect,
  onToggle,
  onOpenFile,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: DriveTreeProps) {
  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, DriveItem[]>()
    for (const item of items) {
      const siblings = map.get(item.parent_id) ?? []
      siblings.push(item)
      map.set(item.parent_id, siblings)
    }
    for (const [parentId, siblings] of map) {
      map.set(parentId, sortItems(siblings))
    }
    return map
  }, [items])

  function renderItems(parentId: number | null, depth: number) {
    const children = childrenByParent.get(parentId) ?? []

    return children.map((item) => {
      const isFolder = item.kind === 'folder'
      const isOpen = expandedIds.has(item.id)
      const isSelected = selectedIds.has(item.id)
      const isDropTarget = dragOverTarget === item.id

      return (
        <div key={item.id}>
          <div
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={isSelected}
            aria-expanded={isFolder ? isOpen : undefined}
            tabIndex={0}
            draggable
            onClick={(event) => onSelect(item, event)}
            onDoubleClick={() => {
              if (isFolder) {
                onToggle(item)
              } else {
                onOpenFile(item)
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onContextMenu(event, item)
            }}
            onDragStart={(event) => onDragStart(event, item)}
            onDragOver={
              isFolder
                ? (event) => onDragOver(event, item.id)
                : undefined
            }
            onDragLeave={isFolder ? onDragLeave : undefined}
            onDrop={isFolder ? (event) => onDrop(event, item.id) : undefined}
            style={{ paddingLeft: `${8 + depth * 18}px` }}
            className={`group flex cursor-default select-none items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm outline-none transition ${
              isSelected
                ? 'bg-indigo-100 text-indigo-900'
                : 'text-slate-700 hover:bg-slate-100'
            } ${isDropTarget ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
          >
            {isFolder ? (
              <button
                type="button"
                aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggle(item)
                }}
                className="grid h-4 w-4 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <ChevronIcon open={isOpen} />
              </button>
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}

            {isFolder ? (
              <FolderIcon
                open={isOpen}
                className="h-4 w-4 shrink-0 text-amber-500"
              />
            ) : (
              <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
            )}

            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {!isFolder && (
              <span className="shrink-0 text-xs text-slate-400">
                {formatBytes(item.size_bytes)}
              </span>
            )}
          </div>

          {isFolder && isOpen && renderItems(item.id, depth + 1)}
        </div>
      )
    })
  }

  const rootChildren = renderItems(null, 0)

  return (
    <div
      role="tree"
      aria-label="Drive contents"
      className="min-h-0 flex-1 overflow-y-auto p-2"
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(event)
      }}
    >
      <div
        role="treeitem"
        aria-level={1}
        aria-selected={currentFolderId === null}
        tabIndex={0}
        onClick={onSelectRoot}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onContextMenu(event)
        }}
        onDragOver={(event) => onDragOver(event, null)}
        onDragLeave={onDragLeave}
        onDrop={(event) => onDrop(event, null)}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
          dragOverTarget === 'root'
            ? 'bg-indigo-50 text-indigo-800 ring-2 ring-inset ring-indigo-500'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <DriveIcon className="h-4 w-4 text-indigo-500" />
        <span>Drive root</span>
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-slate-400">
          This drive is empty. Create a folder, create a file, or upload one to
          get started.
        </p>
      ) : (
        rootChildren
      )}
    </div>
  )
}
