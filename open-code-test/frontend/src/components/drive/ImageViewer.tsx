import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

import { Button } from '../Button'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

interface ImageViewerProps {
  src: string
  alt: string
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

export function ImageViewer({ src, alt }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setDragging(false)
    dragRef.current = null
  }, [src])

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }

    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault()
      if (event.deltaY === 0) {
        return
      }
      setZoom((current) =>
        clampZoom(current * (event.deltaY < 0 ? 1.15 : 1 / 1.15)),
      )
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [])

  function zoomBy(factor: number) {
    setZoom((current) => clampZoom(current * factor))
  }

  function resetView() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return
    }
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`relative flex h-[26rem] touch-none select-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={resetView}
        style={{
          backgroundImage:
            'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
          backgroundSize: '18px 18px',
          backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0',
        }}
      >
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            className="px-2 py-1"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => zoomBy(1 / 1.25)}
          >
            −
          </Button>
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            className="px-2 py-1"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomBy(1.25)}
          >
            +
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={resetView}
          >
            Reset
          </Button>
        </div>

        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none max-h-full max-w-full object-contain shadow-sm"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
      <p className="text-xs text-slate-400">
        Drag to pan · scroll or use +/− to zoom · double-click to reset
      </p>
    </div>
  )
}
