import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import Cropper from 'cropperjs'
import { Minus, Plus } from 'lucide-react'
import {
  coverSelection,
  cropFromRects,
  layoutCrop,
  type Rect,
} from '../photos/crop'
import { noCrop, type Crop } from '../photos/image'

const corners = [
  ['nw', 'superiore sinistro'],
  ['ne', 'superiore destro'],
  ['sw', 'inferiore sinistro'],
  ['se', 'inferiore destro'],
] as const

const template = `<cropper-canvas scale-step="0.1">
  <cropper-image scalable translatable></cropper-image>
  <cropper-shade></cropper-shade>
  <cropper-handle action="move" plain role="button" tabindex="0" aria-label="Sposta la foto"></cropper-handle>
  <cropper-selection movable resizable precise outlined>
    <cropper-grid covered aria-hidden="true"></cropper-grid>
    <cropper-handle action="move" plain role="button" tabindex="0" aria-label="Sposta il ritaglio"></cropper-handle>
    ${corners.map(([corner, label]) => `<cropper-handle class="photo-crop-${corner}" action="${corner}-resize" role="button" tabindex="0" aria-label="Angolo ${label} del ritaglio"></cropper-handle>`).join('')}
  </cropper-selection>
</cropper-canvas>`

export function PhotoCropper({
  source,
  url,
  disabled,
  onChange,
  onReadyChange,
  onError,
}: {
  source: HTMLImageElement
  url: string
  disabled: boolean
  onChange: (crop: Crop) => void
  onReadyChange: (ready: boolean) => void
  onError: (message: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<Cropper>(null)
  const callbacks = useRef({ onChange, onReadyChange, onError, disabled })
  callbacks.current = { onChange, onReadyChange, onError, disabled }
  const [ready, setReady] = useState(false)
  const help = useId()

  useEffect(() => {
    const container = host.current!
    let disposed = false
    let initialized = false
    let imageLoaded = false
    let updating = false
    let frame = 0
    let currentCrop = noCrop
    const size = { width: source.naturalWidth, height: source.naturalHeight }
    const img = new Image()
    img.src = url
    img.alt = 'Foto scelta: trascina la griglia o ingrandisci con due dita'
    const cropper = new Cropper(img, { container, template })
    instance.current = cropper
    const canvas = cropper.getCropperCanvas()!
    const image = cropper.getCropperImage()!
    const selection = cropper.getCropperSelection()!
    canvas.disabled = callbacks.current.disabled
    canvas.querySelectorAll('[role="button"]').forEach((handle) => {
      handle.setAttribute('aria-describedby', help)
    })
    setReady(false)
    callbacks.current.onReadyChange(false)

    // CropperJS scales around the image centre. Rotation/skew remain disabled.
    const imageRect = (matrix = image.$getTransform()): Rect => ({
      x: (size.width * (1 - matrix[0])) / 2 + matrix[4],
      y: (size.height * (1 - matrix[3])) / 2 + matrix[5],
      width: size.width * matrix[0],
      height: size.height * matrix[3],
    })
    const setImage = (rect: Rect) => {
      const scale = rect.width / size.width
      image.$setTransform(
        scale,
        0,
        0,
        scale,
        rect.x - (size.width * (1 - scale)) / 2,
        rect.y - (size.height * (1 - scale)) / 2,
      )
    }
    const publish = (rect: Rect, selected: Rect) => {
      currentCrop = cropFromRects(rect, selected)
      callbacks.current.onChange(currentCrop)
    }
    const reframe = () => {
      if (disposed || !imageLoaded) return
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const layout = layoutCrop(currentCrop, size, bounds)
      updating = true
      setImage(layout.image)
      selection.$change(
        layout.selection.x,
        layout.selection.y,
        layout.selection.width,
        layout.selection.height,
      )
      updating = false
      if (!initialized) {
        initialized = true
        publish(imageRect(), selection)
        setReady(true)
        callbacks.current.onReadyChange(true)
      }
    }
    const changeSelection = (event: Event) => {
      if (updating || !initialized) return
      const next = (event as CustomEvent<Rect>).detail
      const bounds = canvas.getBoundingClientRect()
      if (
        callbacks.current.disabled ||
        next.width < Math.min(96, bounds.width - 16, selection.width) ||
        next.height < Math.min(96, bounds.height - 16, selection.height) ||
        next.x < 0 ||
        next.y < 0 ||
        next.x + next.width > bounds.width + 0.1 ||
        next.y + next.height > bounds.height + 0.1
      ) {
        event.preventDefault()
        return
      }
      const covered = coverSelection(imageRect(), next)
      updating = true
      setImage(covered)
      updating = false
      publish(covered, next)
    }
    const transformImage = (event: Event) => {
      if (updating || !initialized) return
      if (callbacks.current.disabled) {
        event.preventDefault()
        return
      }
      const { matrix } = (event as CustomEvent<{ matrix: number[] }>).detail
      const maxScale =
        Math.min(
          canvas.clientWidth / size.width,
          canvas.clientHeight / size.height,
        ) * 16
      const scale = Math.min(matrix[0], maxScale)
      const proposed = imageRect([scale, 0, 0, scale, matrix[4], matrix[5]])
      const covered = coverSelection(proposed, selection)
      if (
        Math.abs(covered.x - proposed.x) > 0.001 ||
        Math.abs(covered.y - proposed.y) > 0.001 ||
        Math.abs(covered.width - proposed.width) > 0.001 ||
        scale !== matrix[0]
      ) {
        event.preventDefault()
        updating = true
        setImage(covered)
        updating = false
      }
      publish(covered, selection)
    }
    const endAction = (event: Event) => {
      const action = (event as CustomEvent<{ action: string }>).detail.action
      if (
        initialized &&
        !callbacks.current.disabled &&
        action.endsWith('-resize')
      )
        reframe()
    }
    selection.addEventListener('change', changeSelection)
    image.addEventListener('transform', transformImage)
    canvas.addEventListener('actionend', endAction)
    const observer = new ResizeObserver(() => {
      if (!imageLoaded) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reframe)
    })
    observer.observe(canvas)
    void image
      .$ready()
      .then(() => {
        if (disposed) return
        imageLoaded = true
        frame = requestAnimationFrame(reframe)
      })
      .catch(() => {
        if (!disposed)
          callbacks.current.onError(
            'Non riesco ad aprire l’anteprima. Scegli di nuovo la foto.',
          )
      })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      selection.removeEventListener('change', changeSelection)
      image.removeEventListener('transform', transformImage)
      canvas.removeEventListener('actionend', endAction)
      cropper.destroy()
      image.removeAttribute('src')
      img.removeAttribute('src')
      instance.current = null
    }
  }, [source, url, help])

  useEffect(() => {
    const canvas = instance.current?.getCropperCanvas()
    if (canvas) canvas.disabled = disabled
  }, [disabled])

  function zoom(amount: number) {
    if (!ready || disabled) return
    const cropper = instance.current!
    const image = cropper.getCropperImage()!
    const selected = cropper.getCropperSelection()!
    const box = image.getBoundingClientRect()
    const viewport = cropper.getCropperCanvas()!.getBoundingClientRect()
    image.$zoom(
      amount,
      viewport.x + selected.x + selected.width / 2 - box.x,
      viewport.y + selected.y + selected.height / 2 - box.y,
    )
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (!ready || disabled) return
    const action = (event.target as HTMLElement).getAttribute('action')
    if (!action) return
    if (event.key === '+' || event.key === '-') {
      event.preventDefault()
      zoom(event.key === '+' ? 0.1 : -0.1)
      return
    }
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return
    event.preventDefault()
    const step = event.shiftKey ? 10 : 2
    const dx =
      event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
    const dy =
      event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
    const cropper = instance.current!
    const selection = cropper.getCropperSelection()!
    if (action.endsWith('-resize')) selection.$resize(action, dx, dy)
    else if (selection.contains(event.target as Node)) selection.$move(dx, dy)
    else cropper.getCropperImage()!.$move(dx, dy)
  }

  return (
    <div className="photo-editor-image">
      <span id={help} className="sr-only">
        Trascina il centro per spostare la griglia e gli angoli per ritagliare.
        Ingrandisci con due dita o con i pulsanti sulla foto. Con la tastiera
        usa le frecce, Maiusc per spostamenti ampi, più e meno per lo zoom.
      </span>
      <div
        className="photo-cropper-frame"
        style={{
          aspectRatio: `${source.naturalWidth} / ${source.naturalHeight}`,
        }}
      >
        <div
          ref={host}
          className="photo-cropper"
          onKeyDown={key}
          aria-busy={!ready}
        />
        {!ready && (
          <span className="photo-crop-loading" role="status">
            Apro la foto…
          </span>
        )}
        <div className="photo-zoom">
          <button
            type="button"
            aria-label="Riduci foto"
            disabled={disabled || !ready}
            onClick={() => zoom(-0.15)}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ingrandisci foto"
            disabled={disabled || !ready}
            onClick={() => zoom(0.15)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
