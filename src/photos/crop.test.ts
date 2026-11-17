import { expect, it } from 'vitest'
import { adjustCrop } from './crop'
import { cropBounds, noCrop } from './image'

it('sposta un ritaglio fino ai bordi senza alterarne le dimensioni', () => {
  const start = { left: 10, top: 20, right: 40, bottom: 30 }
  expect(adjustCrop(start, 'move', 200, -200)).toEqual({
    left: 50,
    top: 0,
    right: 0,
    bottom: 50,
  })
  expect(adjustCrop(start, 'move', 15, 10)).toEqual({
    left: 25,
    top: 30,
    right: 25,
    bottom: 20,
  })
})
it('ridimensiona gli angoli senza uscire dalla foto o invertire il rettangolo', () => {
  expect(adjustCrop(noCrop, 'nw', 20, 30)).toEqual({
    left: 20,
    top: 30,
    right: 0,
    bottom: 0,
  })
  const result = adjustCrop(noCrop, 'se', -200, -200)
  expect(result).toEqual({ left: 0, top: 0, right: 90, bottom: 90 })
  expect(cropBounds(1600, 1200, result)).toEqual({
    x: 0,
    y: 0,
    width: 160,
    height: 120,
  })
  expect(adjustCrop(noCrop, 'ne', 200, -200)).toEqual(noCrop)
})
it('ritaglia anche una zona spostata oltre metà immagine e rifiuta selezioni vuote', () => {
  expect(
    cropBounds(1600, 1200, { left: 70, right: 10, top: 0, bottom: 0 }),
  ).toEqual({ x: 1120, y: 0, width: 320, height: 1200 })
  expect(() =>
    cropBounds(1600, 1200, { left: 60, right: 40, top: 0, bottom: 0 }),
  ).toThrow()
})
