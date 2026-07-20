'use client'
import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useReducedMotion } from 'framer-motion'

interface PinchZoomImageProps {
  src: string
  alt: string
  maxScale?: number
}

const MIN_SCALE = 1

interface Point {
  x: number
  y: number
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Real two-finger pinch-to-zoom + drag-to-pan on touch, wheel-to-zoom + drag
 * on desktop, built on the native Pointer Events API. Scale is clamped
 * between 1x and `maxScale`; pan is clamped so the image edge can never be
 * dragged past the container edge. Zoom always scales around whatever pan
 * offset is already set (not a moving pinch midpoint) — a deliberate
 * simplification that keeps the gesture predictable.
 */
export function PinchZoomImage({ src, alt, maxScale = 4 }: PinchZoomImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, Point>())
  const pinchStart = useRef<{ distance: number; scale: number; pan: Point } | null>(null)
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [isGesturing, setIsGesturing] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  function clampPan(nextPan: Point, nextScale: number): Point {
    const el = imgRef.current
    if (!el) return nextPan
    const rect = el.getBoundingClientRect()
    // rect is the image's own current (already-scaled) box, so divide out
    // nextScale to get the unscaled size the clamp math expects.
    const unscaledWidth = rect.width / scale
    const unscaledHeight = rect.height / scale
    const maxX = (unscaledWidth * (nextScale - 1)) / 2
    const maxY = (unscaledHeight * (nextScale - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setIsGesturing(true)

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinchStart.current = { distance: distance(a, b), scale, pan }
      dragStart.current = null
    } else if (pointers.current.size === 1 && scale > MIN_SCALE) {
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values())
      if (pinchStart.current.distance === 0) return
      const ratio = distance(a, b) / pinchStart.current.distance
      const nextScale = Math.max(MIN_SCALE, Math.min(maxScale, pinchStart.current.scale * ratio))
      setScale(nextScale)
      setPan(clampPan(pinchStart.current.pan, nextScale))
    } else if (pointers.current.size === 1 && dragStart.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPan(clampPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy }, scale))
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    pinchStart.current = null

    if (pointers.current.size === 1) {
      // One finger survives a pinch's release — hand off into single-finger
      // pan using its last known position, instead of dropping movement
      // until a full release/re-press (fingers rarely lift in a clean pair).
      const [remaining] = Array.from(pointers.current.values())
      dragStart.current =
        scale > MIN_SCALE ? { x: remaining.x, y: remaining.y, panX: pan.x, panY: pan.y } : null
    } else {
      dragStart.current = null
    }

    if (pointers.current.size === 0) setIsGesturing(false)
    if (scale <= MIN_SCALE) setPan({ x: 0, y: 0 })
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const nextScale = Math.max(MIN_SCALE, Math.min(maxScale, scale - e.deltaY * 0.01))
    setScale(nextScale)
    setPan((prev) => clampPan(prev, nextScale))
  }

  return (
    <div
      className="relative flex max-h-[85vh] max-w-[90vw] touch-none select-none items-center justify-center overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      data-testid="pinch-zoom-container"
      data-scale={scale.toFixed(2)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-[85vh] max-w-[90vw] object-contain"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transition: isGesturing || prefersReducedMotion ? 'none' : 'transform 0.2s ease-out',
        }}
      />
    </div>
  )
}
