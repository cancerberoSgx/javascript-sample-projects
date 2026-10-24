import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent, MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, getErrorMessage } from '../api/client'
import { Button } from '../components/Button'
import { ContextMenu } from '../components/drive/ContextMenu'
import type { ContextMenuItem } from '../components/drive/ContextMenu'
import { DriveEditor } from '../components/drive/DriveEditor'
import { DriveIcon } from '../components/drive/DriveIcons'
import { DriveTree } from '../components/drive/DriveTree'
import { ErrorAlert } from '../components/ErrorAlert'
import { Loading } from '../components/Loading'
import { Modal } from '../components/Modal'
import type {
  Drive,
  DriveItem,
  DriveItemDetail,
  Organization,
} from '../types'

type DriveModal =
  | { kind: 'create-drive' }
  | { kind: 'rename-drive'; drive: Drive }
  | { kind: 'create-folder'; parentId: number | null }
  | { kind: 'create-file'; parentId: number | null }
  | { kind: 'rename-item'; item: DriveItem }

type ContextTarget =
  | { kind: 'item'; item: DriveItem | null }
  | { kind: 'drive'; drive: Drive }

interface OpenMenu {
  x: number
  y: number
  target: ContextTarget
}

interface Clipboard {
  driveId: number
  itemIds: number[]
}

export function DrivesPage() {
  const { organizationId: organizationIdParam } = useParams<{
    organizationId: string
  }>()
  const organizationId = Number(organizationIdParam)

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [drives, setDrives] = useState<Drive[]>([])
  const [selectedDriveId, setSelectedDriveId] = useState<number | null>(null)
  const [items, setItems] = useState<DriveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<number | 'root' | null>(
    null,
  )
  const dragSourceIdsRef = useRef<number[]>([])

  const [contextMenu, setContextMenu] = useState<OpenMenu | null>(null)
  const [modal, setModal] = useState<DriveModal | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<number | null>(null)

  const [activeFile, setActiveFile] = useState<DriveItemDetail | null>(null)
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editorError, setEditorError] = useState('')
  const fileRequestRef = useRef(0)
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined)

  const loadDrives = useCallback(async () => {
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
      setError('Invalid organization')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [loadedOrganization, loadedDrives] = await Promise.all([
        api.getOrganization(organizationId),
        api.listDrives(organizationId),
      ])
      setOrganization(loadedOrganization)
      setDrives(loadedDrives)
      setSelectedDriveId((current) => {
        if (current !== null && loadedDrives.some((drive) => drive.id === current)) {
          return current
        }
        return loadedDrives[0]?.id ?? null
      })
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void loadDrives()
  }, [loadDrives])

  useEffect(() => {
    setSelectedIds(new Set())
    setExpandedIds(new Set())
    setCurrentFolderId(null)
    setClipboard(null)
    setActiveFile(null)
    setContent('')
    setDirty(false)
    setEditorError('')

    if (selectedDriveId === null) {
      setItems([])
      return
    }

    let active = true
    setItemsLoading(true)

    api
      .listDriveItems(organizationId, selectedDriveId)
      .then((loadedItems) => {
        if (active) {
          setItems(loadedItems)
        }
      })
      .catch((err) => {
        if (active) {
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (active) {
          setItemsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [organizationId, selectedDriveId])

  useEffect(() => {
    if (!dirty) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const selectedDrive =
    drives.find((drive) => drive.id === selectedDriveId) ?? null
  const selectedItems = items.filter((item) => selectedIds.has(item.id))
  const selectedSingle = selectedItems.length === 1 ? selectedItems[0] : null
  const canPaste =
    clipboard !== null &&
    selectedDriveId !== null &&
    clipboard.driveId === selectedDriveId
  const currentFolderName =
    currentFolderId === null
      ? 'Drive root'
      : (items.find((item) => item.id === currentFolderId)?.name ?? 'Drive root')

  function canDiscardChanges(): boolean {
    return !dirty || window.confirm('Discard unsaved changes to this file?')
  }

  function closeEditor() {
    setActiveFile(null)
    setContent('')
    setDirty(false)
    setEditorError('')
  }

  async function refreshItems(driveId: number): Promise<DriveItem[]> {
    const loadedItems = await api.listDriveItems(organizationId, driveId)
    setItems(loadedItems)

    const ids = new Set(loadedItems.map((item) => item.id))
    setSelectedIds((current) => new Set([...current].filter((id) => ids.has(id))))
    setExpandedIds((current) => new Set([...current].filter((id) => ids.has(id))))
    setCurrentFolderId((current) =>
      current !== null && !ids.has(current) ? null : current,
    )

    if (activeFile && !ids.has(activeFile.id)) {
      closeEditor()
    }

    return loadedItems
  }

  function selectDrive(drive: Drive) {
    if (drive.id === selectedDriveId) {
      return
    }
    if (!canDiscardChanges()) {
      return
    }
    setSelectedDriveId(drive.id)
  }

  function selectRoot() {
    setSelectedIds(new Set())
    setCurrentFolderId(null)
  }

  function handleSelect(item: DriveItem, event: MouseEvent<HTMLDivElement>) {
    if (event.metaKey || event.ctrlKey) {
      setSelectedIds((current) => {
        const next = new Set(current)
        if (next.has(item.id)) {
          next.delete(item.id)
        } else {
          next.add(item.id)
        }
        return next
      })
      setCurrentFolderId(item.kind === 'folder' ? item.id : item.parent_id)
      return
    }

    setSelectedIds(new Set([item.id]))
    setCurrentFolderId(item.kind === 'folder' ? item.id : item.parent_id)

    if (item.kind === 'file') {
      void openFile(item)
    }
  }

  function toggleFolder(item: DriveItem) {
    if (item.kind !== 'folder') {
      return
    }

    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }
      return next
    })
    setSelectedIds(new Set([item.id]))
    setCurrentFolderId(item.id)
  }

  async function openFile(item: DriveItem) {
    if (activeFile?.id === item.id) {
      return
    }
    if (!canDiscardChanges()) {
      return
    }

    const requestId = ++fileRequestRef.current
    setFileLoading(true)
    setEditorError('')

    try {
      const detail = await api.getDriveItem(
        organizationId,
        item.drive_id,
        item.id,
      )
      if (requestId !== fileRequestRef.current) {
        return
      }
      setActiveFile(detail)
      setContent(detail.content ?? '')
      setDirty(false)
    } catch (err) {
      if (requestId === fileRequestRef.current) {
        setEditorError(getErrorMessage(err))
      }
    } finally {
      if (requestId === fileRequestRef.current) {
        setFileLoading(false)
      }
    }
  }

  function handleContentChange(value: string) {
    setContent(value)
    setDirty(value !== (activeFile?.content ?? ''))
  }

  async function saveFile() {
    if (!activeFile || !dirty || saving) {
      return
    }

    setSaving(true)
    setEditorError('')

    try {
      const updated = await api.updateFileContent(
        organizationId,
        activeFile.drive_id,
        activeFile.id,
        content,
      )
      setActiveFile(updated)
      setContent(updated.content ?? '')
      setDirty(false)
      await refreshItems(updated.drive_id)
    } catch (err) {
      setEditorError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function beginUpload(targetParentId: number | null) {
    if (!selectedDriveId || uploading) {
      return
    }
    uploadTargetRef.current = targetParentId
    uploadInputRef.current?.click()
  }

  async function handleUploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const targetParentId = uploadTargetRef.current
    uploadTargetRef.current = null

    if (!selectedDriveId || files.length === 0) {
      return
    }

    const driveId = selectedDriveId
    setUploading(true)
    setEditorError('')

    try {
      const uploaded: DriveItem[] = []
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          uploaded.push(
            ...(await api.uploadZip(
              organizationId,
              driveId,
              file,
              targetParentId,
            )),
          )
        } else {
          uploaded.push(
            await api.uploadFile(
              organizationId,
              driveId,
              file,
              targetParentId,
            ),
          )
        }
      }

      await refreshItems(driveId)
      if (uploaded.length > 0) {
        setSelectedIds(new Set(uploaded.map((item) => item.id)))
        setCurrentFolderId(targetParentId)
        if (targetParentId !== null) {
          setExpandedIds((current) => new Set(current).add(targetParentId))
        }
        if (
          files.length === 1 &&
          uploaded.length === 1 &&
          uploaded[0].kind === 'file'
        ) {
          await openFile(uploaded[0])
        }
      }
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
      await refreshItems(driveId).catch(() => undefined)
    } finally {
      setUploading(false)
    }
  }

  async function downloadFile(item: DriveItem) {
    try {
      const { blob, filename } = await api.downloadFile(
        organizationId,
        item.drive_id,
        item.id,
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || item.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function copyItems(targets: DriveItem[]) {
    if (!selectedDriveId || targets.length === 0) {
      return
    }

    const itemIds = targets.map((item) => item.id)
    setClipboard({ driveId: selectedDriveId, itemIds })
    setSelectedIds(new Set(itemIds))
  }

  function copySelection() {
    copyItems(selectedItems)
  }

  async function pasteInto(targetParentId: number | null) {
    if (
      !clipboard ||
      !selectedDriveId ||
      clipboard.driveId !== selectedDriveId
    ) {
      return
    }

    try {
      await api.copyDriveItems(organizationId, selectedDriveId, {
        item_ids: clipboard.itemIds,
        target_parent_id: targetParentId,
      })
      await refreshItems(selectedDriveId)
      if (targetParentId !== null) {
        setExpandedIds((current) => new Set(current).add(targetParentId))
      }
      setCurrentFolderId(targetParentId)
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function isInSubtree(targetId: number | null, ancestorId: number): boolean {
    let currentId = targetId
    while (currentId !== null) {
      if (currentId === ancestorId) {
        return true
      }
      const parent = items.find((item) => item.id === currentId)
      currentId = parent?.parent_id ?? null
    }
    return false
  }

  async function deleteItems(targets: DriveItem[]) {
    if (!selectedDriveId || targets.length === 0) {
      return
    }

    const unique = [...new Map(targets.map((item) => [item.id, item])).values()]
    const selectedIdSet = new Set(unique.map((item) => item.id))
    const topLevel = unique.filter((item) => {
      let parentId = item.parent_id
      while (parentId !== null) {
        if (selectedIdSet.has(parentId)) {
          return false
        }
        const parent = items.find((candidate) => candidate.id === parentId)
        parentId = parent?.parent_id ?? null
      }
      return true
    })

    const label =
      topLevel.length === 1 ? `"${topLevel[0].name}"` : `${topLevel.length} items`

    if (
      !window.confirm(
        `Delete ${label}? Folders are deleted with everything inside them. This cannot be undone.`,
      )
    ) {
      return
    }

    try {
      for (const item of topLevel) {
        await api.deleteDriveItem(organizationId, selectedDriveId, item.id)
      }
      await refreshItems(selectedDriveId)
      setSelectedIds(new Set())
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
      await refreshItems(selectedDriveId)
    }
  }

  function deleteDrive(drive: Drive) {
    if (
      !window.confirm(
        `Delete drive "${drive.name}" and everything inside it? This cannot be undone.`,
      )
    ) {
      return
    }

    void (async () => {
      try {
        await api.deleteDrive(organizationId, drive.id)
        const loadedDrives = await api.listDrives(organizationId)
        setDrives(loadedDrives)
        if (activeFile?.drive_id === drive.id) {
          closeEditor()
        }
        setSelectedDriveId((current) => {
          if (current !== drive.id) {
            return current
          }
          return loadedDrives[0]?.id ?? null
        })
        setError('')
      } catch (err) {
        setError(getErrorMessage(err))
      }
    })()
  }

  function openNameModal(nextModal: DriveModal) {
    setModal(nextModal)
    setModalName(
      nextModal.kind === 'rename-item'
        ? nextModal.item.name
        : nextModal.kind === 'rename-drive'
          ? nextModal.drive.name
          : '',
    )
    setModalError('')
  }

  async function handleModalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modal) {
      return
    }

    const name = modalName.trim()
    if (!name) {
      setModalError('Name is required')
      return
    }

    setModalSaving(true)
    setModalError('')

    try {
      if (modal.kind === 'create-drive') {
        const created = await api.createDrive(organizationId, name)
        const loadedDrives = await api.listDrives(organizationId)
        setDrives(loadedDrives)
        setSelectedDriveId(created.id)
      } else if (modal.kind === 'rename-drive') {
        const updated = await api.updateDrive(
          organizationId,
          modal.drive.id,
          name,
        )
        setDrives((current) =>
          current.map((drive) => (drive.id === updated.id ? updated : drive)),
        )
      } else if (modal.kind === 'create-folder') {
        if (!selectedDriveId) {
          return
        }
        const created = await api.createFolder(organizationId, selectedDriveId, {
          name,
          parent_id: modal.parentId,
        })
        await refreshItems(selectedDriveId)
        if (modal.parentId !== null) {
          setExpandedIds((current) => new Set(current).add(modal.parentId!))
        }
        setSelectedIds(new Set([created.id]))
        setCurrentFolderId(created.id)
      } else if (modal.kind === 'create-file') {
        if (!selectedDriveId) {
          return
        }
        const created = await api.createFile(organizationId, selectedDriveId, {
          name,
          parent_id: modal.parentId,
        })
        await refreshItems(selectedDriveId)
        if (modal.parentId !== null) {
          setExpandedIds((current) => new Set(current).add(modal.parentId!))
        }
        setSelectedIds(new Set([created.id]))
        setCurrentFolderId(created.parent_id)
        await openFile(created)
      } else {
        const updated = await api.updateDriveItem(
          organizationId,
          modal.item.drive_id,
          modal.item.id,
          { name },
        )
        await refreshItems(updated.drive_id)
        setSelectedIds(new Set([updated.id]))
        setActiveFile((current) =>
          current && current.id === updated.id
            ? { ...current, name: updated.name }
            : current,
        )
      }
      setModal(null)
    } catch (err) {
      setModalError(getErrorMessage(err))
    } finally {
      setModalSaving(false)
    }
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const isEditable =
      target !== null &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    const isInteractive =
      target !== null &&
      target.closest(
        'button, a, input, textarea, select, [contenteditable="true"]',
      ) !== null

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void saveFile()
      return
    }

    if (isEditable) {
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      if (selectedIds.size > 0) {
        event.preventDefault()
        copySelection()
      }
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      if (canPaste) {
        event.preventDefault()
        void pasteInto(currentFolderId)
      }
      return
    }

    if (event.key === 'Enter' && selectedSingle && !isInteractive) {
      event.preventDefault()
      if (selectedSingle.kind === 'folder') {
        toggleFolder(selectedSingle)
      } else {
        void openFile(selectedSingle)
      }
      return
    }

    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      selectedItems.length > 0 &&
      !isInteractive
    ) {
      event.preventDefault()
      void deleteItems(selectedItems)
      return
    }

    if (event.key === 'F2' && selectedSingle && !isInteractive) {
      event.preventDefault()
      openNameModal({ kind: 'rename-item', item: selectedSingle })
    }
  }

  keyHandlerRef.current = handleWindowKeyDown

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      keyHandlerRef.current(event)
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  function handleDragStart(event: DragEvent<HTMLDivElement>, item: DriveItem) {
    const ids = selectedIds.has(item.id)
      ? [...selectedIds]
      : [item.id]

    dragSourceIdsRef.current = ids
    if (!selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]))
      setCurrentFolderId(item.kind === 'folder' ? item.id : item.parent_id)
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', ids.join(','))
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    target: number | null,
  ) {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDragOverTarget(target ?? 'root')
  }

  function handleDragLeave() {
    setDragOverTarget(null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, target: number | null) {
    event.preventDefault()
    event.stopPropagation()
    setDragOverTarget(null)

    const ids = dragSourceIdsRef.current
    dragSourceIdsRef.current = []
    if (!selectedDriveId || ids.length === 0) {
      return
    }

    void (async () => {
      for (const itemId of ids) {
        const source = items.find((item) => item.id === itemId)
        if (!source || source.parent_id === target) {
          continue
        }
        if (
          source.kind === 'folder' &&
          target !== null &&
          isInSubtree(target, source.id)
        ) {
          setError('Cannot move a folder into itself or its descendants')
          continue
        }

        try {
          await api.updateDriveItem(
            organizationId,
            selectedDriveId,
            source.id,
            { parent_id: target },
          )
        } catch (err) {
          setError(getErrorMessage(err))
        }
      }

      await refreshItems(selectedDriveId)
      if (target !== null) {
        setExpandedIds((current) => new Set(current).add(target))
      }
      setCurrentFolderId(target)
    })()
  }

  function openItemMenu(event: MouseEvent, item?: DriveItem) {
    event.preventDefault()
    event.stopPropagation()

    if (item) {
      if (!selectedIds.has(item.id)) {
        setSelectedIds(new Set([item.id]))
        setCurrentFolderId(item.kind === 'folder' ? item.id : item.parent_id)
      }
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: 'item', item },
      })
    } else {
      setSelectedIds(new Set())
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: 'item', item: null },
      })
    }
  }

  function openDriveMenu(event: MouseEvent, drive: Drive) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: { kind: 'drive', drive },
    })
  }

  function contextMenuItems(target: ContextTarget): ContextMenuItem[] {
    if (target.kind === 'drive') {
      return [
        {
          label: 'Rename drive',
          onSelect: () =>
            openNameModal({ kind: 'rename-drive', drive: target.drive }),
        },
        {
          label: 'Delete drive',
          danger: true,
          onSelect: () => deleteDrive(target.drive),
        },
      ]
    }

    const item = target.item

    if (!item) {
      return [
        {
          label: 'New folder',
          onSelect: () =>
            openNameModal({ kind: 'create-folder', parentId: currentFolderId }),
        },
        {
          label: 'New file',
          onSelect: () =>
            openNameModal({ kind: 'create-file', parentId: currentFolderId }),
        },
        {
          label: 'Upload file or ZIP',
          onSelect: () => beginUpload(currentFolderId),
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          disabled: !canPaste,
          onSelect: () => void pasteInto(currentFolderId),
        },
      ]
    }

    if (item.kind === 'folder') {
      return [
        {
          label: 'Open folder',
          onSelect: () => toggleFolder(item),
        },
        {
          label: 'New folder',
          onSelect: () =>
            openNameModal({ kind: 'create-folder', parentId: item.id }),
        },
        {
          label: 'New file',
          onSelect: () =>
            openNameModal({ kind: 'create-file', parentId: item.id }),
        },
        {
          label: 'Upload file or ZIP',
          onSelect: () => beginUpload(item.id),
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          disabled: !canPaste,
          onSelect: () => void pasteInto(item.id),
        },
        {
          label: 'Rename',
          shortcut: 'F2',
          onSelect: () => openNameModal({ kind: 'rename-item', item }),
        },
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          onSelect: () => copyItems([item]),
        },
        {
          label: 'Delete',
          shortcut: 'Del',
          danger: true,
          onSelect: () => void deleteItems([item]),
        },
      ]
    }

    return [
      {
        label: 'Open',
        onSelect: () => void openFile(item),
      },
      {
        label: 'Download',
        onSelect: () => void downloadFile(item),
      },
      {
        label: 'Rename',
        shortcut: 'F2',
        onSelect: () => openNameModal({ kind: 'rename-item', item }),
      },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        onSelect: () => copyItems([item]),
      },
      {
        label: 'Delete',
        shortcut: 'Del',
        danger: true,
        onSelect: () => void deleteItems([item]),
      },
    ]
  }

  if (loading) {
    return <Loading label="Loading drives..." />
  }

  if (!organization) {
    return (
      <div className="space-y-4">
        <Link
          to="/organizations"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← Organizations
        </Link>
        <ErrorAlert message={error || 'Organization not found'} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        aria-label="Upload files"
        onChange={(event) => void handleUploadFiles(event)}
      />

      <div>
        <Link
          to={`/organizations/${organization.id}`}
          onClick={(event) => {
            if (!canDiscardChanges()) {
              event.preventDefault()
            }
          }}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          ← {organization.name}
        </Link>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Drives
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Store folders, text files, binary files, images, and extracted
              ZIP archives for this organization. Ctrl/Cmd+click to multi-select; drag to move;
              right-click for more actions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!selectedDriveId}
              onClick={() =>
                openNameModal({
                  kind: 'create-folder',
                  parentId: currentFolderId,
                })
              }
            >
              New folder
            </Button>
            <Button
              variant="secondary"
              disabled={!selectedDriveId}
              onClick={() =>
                openNameModal({
                  kind: 'create-file',
                  parentId: currentFolderId,
                })
              }
            >
              New file
            </Button>
            <Button
              variant="secondary"
              disabled={!selectedDriveId || uploading}
              onClick={() => beginUpload(currentFolderId)}
            >
              {uploading ? 'Uploading...' : 'Upload file or ZIP'}
            </Button>
            <Button onClick={() => openNameModal({ kind: 'create-drive' })}>
              New drive
            </Button>
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card h-fit overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Drives</h2>
            <p className="text-xs text-slate-400">
              All members of this organization can edit these drives.
            </p>
          </div>

          <div className="space-y-1 p-2">
            {drives.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-400">
                No drives yet.
              </p>
            ) : (
              drives.map((drive) => {
                const isSelected = drive.id === selectedDriveId

                return (
                  <div
                    key={drive.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectDrive(drive)}
                    onContextMenu={(event) => openDriveMenu(event, drive)}
                    className={`group flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                      isSelected
                        ? 'bg-indigo-100 font-medium text-indigo-900'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <DriveIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                    <span className="min-w-0 flex-1 truncate">{drive.name}</span>
                    <button
                      type="button"
                      aria-label={`Actions for ${drive.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        openDriveMenu(event, drive)
                      }}
                      className="rounded px-1 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                    >
                      ⋯
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <div className="card flex min-h-[28rem] min-w-0 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {selectedDrive?.name ?? 'No drive selected'}
                </p>
                <p className="truncate text-xs text-slate-400">
                  Paste target: {currentFolderName}
                  {selectedItems.length > 1
                    ? ` · ${selectedItems.length} selected`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={copySelection}
                  disabled={selectedItems.length === 0}
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void pasteInto(currentFolderId)}
                  disabled={!canPaste}
                >
                  Paste
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (selectedSingle) {
                      openNameModal({
                        kind: 'rename-item',
                        item: selectedSingle,
                      })
                    }
                  }}
                  disabled={!selectedSingle}
                >
                  Rename
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void deleteItems(selectedItems)}
                  disabled={selectedItems.length === 0}
                >
                  Delete
                </Button>
              </div>
            </div>

            {selectedDrive === null ? (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <DriveIcon className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    Create or select a drive to browse its files.
                  </p>
                </div>
              </div>
            ) : itemsLoading ? (
              <div className="grid flex-1 place-items-center p-8">
                <Loading label="Loading files..." />
              </div>
            ) : (
              <DriveTree
                items={items}
                selectedIds={selectedIds}
                expandedIds={expandedIds}
                currentFolderId={currentFolderId}
                dragOverTarget={dragOverTarget}
                onSelectRoot={selectRoot}
                onSelect={handleSelect}
                onToggle={toggleFolder}
                onOpenFile={(item) => void openFile(item)}
                onContextMenu={openItemMenu}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            )}
          </div>

          <div className="card min-w-0 overflow-hidden">
            <DriveEditor
              organizationId={organizationId}
              file={activeFile}
              content={content}
              dirty={dirty}
              saving={saving}
              loading={fileLoading}
              error={editorError}
              onChange={handleContentChange}
              onSave={() => void saveFile()}
              onDownload={() => {
                if (activeFile) {
                  void downloadFile(activeFile)
                }
              }}
            />
          </div>
        </div>
      </div>

      <Modal
        open={modal !== null}
        title={
          modal?.kind === 'create-drive'
            ? 'New drive'
            : modal?.kind === 'rename-drive'
              ? 'Rename drive'
              : modal?.kind === 'create-folder'
                ? 'New folder'
                : modal?.kind === 'create-file'
                  ? 'New file'
                  : 'Rename'
        }
        onClose={() => setModal(null)}
      >
        <form className="space-y-4" onSubmit={handleModalSubmit}>
          <div>
            <label className="field-label" htmlFor="drive-item-name">
              Name
            </label>
            <input
              id="drive-item-name"
              className="input"
              autoFocus
              required
              maxLength={255}
              value={modalName}
              onChange={(event) => setModalName(event.target.value)}
              placeholder={
                modal?.kind === 'create-file' ? 'notes.txt' : 'Folder name'
              }
            />
          </div>

          <ErrorAlert message={modalError} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={modalSaving}>
              {modalSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems(contextMenu.target)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
