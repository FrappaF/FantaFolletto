import type { Crop } from './image'

export type CropAction = 'move' | 'nw' | 'ne' | 'sw' | 'se'
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// Deltas are percentages of the whole image, independent of viewport size.
export function adjustCrop(
  start: Crop,
  action: CropAction,
  dx: number,
  dy: number,
): Crop {
  const x = start.left
  const y = start.top
  const right = 100 - start.right
  const bottom = 100 - start.bottom
  if (action === 'move') {
    const left = clamp(x + dx, 0, 100 - (right - x))
    const top = clamp(y + dy, 0, 100 - (bottom - y))
    return {
      left,
      top,
      right: Math.max(0, 100 - left - (right - x)),
      bottom: Math.max(0, 100 - top - (bottom - y)),
    }
  }
  return {
    left: action.includes('w') ? clamp(x + dx, 0, right - 10) : x,
    top: action.includes('n') ? clamp(y + dy, 0, bottom - 10) : y,
    right: action.includes('e')
      ? 100 - clamp(right + dx, x + 10, 100)
      : start.right,
    bottom: action.includes('s')
      ? 100 - clamp(bottom + dy, y + 10, 100)
      : start.bottom,
  }
}
