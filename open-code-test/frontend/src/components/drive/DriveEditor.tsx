import { useEffect, useState } from 'react'

import { api, getErrorMessage } from '../../api/client'
import type { DriveItemDetail } from '../../types'
import { formatBytes, isImageFile, isTextFileType } from '../../utils'
import { Button } from '../Button'
import { ErrorAlert } from '../ErrorAlert'
import { Loading } from '../Loading'
import { FileIcon } from './DriveIcons'
import { ImageViewer } from './ImageViewer'

interface DriveEditorProps {
  organizationId: number
  file: DriveItemDetail | null
  content: string
  dirty: boolean
  saving: boolean
  loading: boolean
  error: string
  onChange: (value: string) => void
  onSave: () => void
  onDownload: () => void
}

export function DriveEditor({
  organizationId,
  file,
  content,
  dirty,
  saving,
  loading,
  error,
  onChange,
  onSave,
  onDownload,
}: DriveEditorProps) {
  const fileId = file?.id ?? null
  const fileDriveId = file?.drive_id ?? null
  const fileType = file?.file_type ?? null
  const fileName = file?.name ?? ''
  const imageFile = file !== null && isImageFile(fileType, fileName)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    setPreviewUrl(null)
    setPreviewError('')
    setPreviewLoading(false)

    if (fileId === null || fileDriveId === null || !imageFile) {
      return
    }

    let active = true
    let objectUrl: string | null = null
    setPreviewLoading(true)

    api
      .downloadFile(organizationId, fileDriveId, fileId)
      .then(({ blob }) => {
        if (!active) {
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((err) => {
        if (active) {
          setPreviewError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (active) {
          setPreviewLoading(false)
        }
      })

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [organizationId, fileId, fileDriveId, imageFile])

  if (loading) {
    return (
      <div className="grid min-h-[24rem] place-items-center p-8">
        <Loading label="Opening file..." />
      </div>
    )
  }

  if (!file) {
    return (
      <div className="grid min-h-[24rem] place-items-center p-8 text-center">
        <div>
          <FileIcon className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Select a file to edit or download
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Text files open in the editor, images in a zoomable viewer, and
            other files can be downloaded.
          </p>
        </div>
      </div>
    )
  }

  const editable = !imageFile && isTextFileType(file.file_type)

  return (
    <div className="flex min-h-[24rem] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {file.name}
            </p>
            <p className="truncate text-xs text-slate-400">
              {imageFile
                ? 'Image preview'
                : editable
                  ? dirty
                    ? 'Unsaved changes'
                    : 'All changes saved'
                  : 'Binary file'}{' '}
              · {file.file_type ?? 'application/octet-stream'} ·{' '}
              {formatBytes(file.size_bytes)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDownload}>
            Download
          </Button>
          {editable && (
            <Button onClick={onSave} disabled={!dirty || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <ErrorAlert message={error} />
        {imageFile ? (
          <>
            <ErrorAlert message={previewError} />
            {previewLoading ? (
              <div className="grid min-h-[26rem] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8">
                <Loading label="Loading image..." />
              </div>
            ) : previewUrl ? (
              <ImageViewer src={previewUrl} alt={file.name} />
            ) : (
              <div className="grid min-h-[26rem] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div>
                  <FileIcon className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    Could not preview this image
                  </p>
                  <div className="mt-4 flex justify-center">
                    <Button variant="secondary" onClick={onDownload}>
                      Download {file.name}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : editable ? (
          <>
            <textarea
              className="input min-h-[26rem] resize-y font-mono text-sm leading-6"
              value={content}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
              placeholder="Start typing..."
            />
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Ctrl+S to save</span>
              <span>{content.length.toLocaleString()} characters</span>
            </div>
          </>
        ) : (
          <div className="grid min-h-[26rem] place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div>
              <FileIcon className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                No preview for this file type
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Download the file to open it with a local application.
              </p>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={onDownload}>
                  Download {file.name}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
