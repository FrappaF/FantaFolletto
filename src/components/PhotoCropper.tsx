import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { Crop } from '../photos/image'
import { adjustCrop, type CropAction } from '../photos/crop'

export function PhotoCropper({
  source,
  url,
  value,
  disabled,
  onChange,
}: {
  source: HTMLImageElement
  url: string
  value: Crop
  disabled: boolean
  onChange: (crop: Crop) => void
}) {
  const image = useRef<HTMLDivElement>(null)
  const help = useId()
  const drag = useRef<
    | {
        pointerId: number
        x: number
        y: number
        width: number
        height: number
        crop: Crop
        action: CropAction
      }
    | undefined
  >(undefined)
  function start(event: PointerEvent<HTMLButtonElement>, action: CropAction) {
    if (disabled || !event.isPrimary || event.button !== 0 || drag.current)
      return
    const bounds = image.current!.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: bounds.width,
      height: bounds.height,
      crop: value,
      action,
    }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId || disabled) return
    onChange(
      adjustCrop(
        current.crop,
        current.action,
        ((event.clientX - current.x) / current.width) * 100,
        ((event.clientY - current.y) / current.height) * 100,
      ),
    )
  }
  function stop(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = undefined
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, action: CropAction) {
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    event.preventDefault()
    const step = event.shiftKey ? 5 : 1
    onChange(
      adjustCrop(
        value,
        action,
        event.key === 'ArrowLeft'
          ? -step
          : event.key === 'ArrowRight'
            ? step
            : 0,
        event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
      ),
    )
  }
  return (
    <div className="photo-editor-image">
      <span id={help} className="sr-only">
        Trascina gli angoli per ritagliare e il centro per spostare la griglia.
        Con la tastiera usa le frecce; tieni premuto Maiusc per spostamenti più
        ampi.
      </span>
      <div
        ref={image}
        className="photo-cropper"
        style={{
          width: `calc(var(--photo-preview-height) * ${source.naturalWidth / source.naturalHeight})`,
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <img
          src={url}
          alt="Foto scelta: trascina la griglia per ritagliare"
          draggable={false}
        />
        <div
          className="photo-crop-selection"
          style={{
            left: `${value.left}%`,
            top: `${value.top}%`,
            right: `${value.right}%`,
            bottom: `${value.bottom}%`,
          }}
        >
          <button
            className="photo-crop-move"
            type="button"
            aria-label="Sposta il ritaglio"
            aria-describedby={help}
            disabled={disabled}
            onPointerDown={(event) => start(event, 'move')}
            onKeyDown={(event) => key(event, 'move')}
          />
          <span className="photo-crop-grid" aria-hidden="true" />
          {(
            [
              ['nw', 'superiore sinistro'],
              ['ne', 'superiore destro'],
              ['sw', 'inferiore sinistro'],
              ['se', 'inferiore destro'],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              className={`photo-crop-handle photo-crop-${action}`}
              type="button"
              aria-label={`Angolo ${label} del ritaglio`}
              aria-describedby={help}
              disabled={disabled}
              onPointerDown={(event) => start(event, action)}
              onKeyDown={(event) => key(event, action)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
