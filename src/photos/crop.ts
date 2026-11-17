import type { Crop } from './image'

export type Rect = { x: number; y: number; width: number; height: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const margin = (value: number) =>
  Math.abs(value) < 1e-8 ? 0 : clamp(value, 0, 100)

// Grow uniformly around the selection, then pan just enough to cover its edges.
export function coverSelection(image: Rect, selection: Rect): Rect {
  const scale = Math.max(
    1,
    selection.width / image.width,
    selection.height / image.height,
  )
  const cx = selection.x + selection.width / 2
  const cy = selection.y + selection.height / 2
  const width = image.width * scale
  const height = image.height * scale
  return {
    x: clamp(
      cx - (cx - image.x) * scale,
      selection.x + selection.width - width,
      selection.x,
    ),
    y: clamp(
      cy - (cy - image.y) * scale,
      selection.y + selection.height - height,
      selection.y,
    ),
    width,
    height,
  }
}

// Translate the editor's displayed rectangles into the original image's margins.
export function cropFromRects(image: Rect, selection: Rect): Crop {
  return {
    left: margin(((selection.x - image.x) / image.width) * 100),
    top: margin(((selection.y - image.y) / image.height) * 100),
    right: margin(
      ((image.x + image.width - selection.x - selection.width) / image.width) *
        100,
    ),
    bottom: margin(
      ((image.y + image.height - selection.y - selection.height) /
        image.height) *
        100,
    ),
  }
}

// Reframe after resizing without changing which source pixels were selected.
export function layoutCrop(
  crop: Crop,
  source: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const width = (source.width * (100 - crop.left - crop.right)) / 100
  const height = (source.height * (100 - crop.top - crop.bottom)) / 100
  const scale = Math.min(
    Math.max(1, viewport.width - 16) / width,
    Math.max(1, viewport.height - 16) / height,
  )
  const selection = {
    x: (viewport.width - width * scale) / 2,
    y: (viewport.height - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  }
  return {
    selection,
    image: {
      x: selection.x - ((source.width * crop.left) / 100) * scale,
      y: selection.y - ((source.height * crop.top) / 100) * scale,
      width: source.width * scale,
      height: source.height * scale,
    },
  }
}
