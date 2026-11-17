import { expect, it } from 'vitest'
import { coverSelection, cropFromRects, layoutCrop } from './crop'
import { cropBounds, noCrop } from './image'

it('sposta la foto fino ai bordi del ritaglio senza deformarla', () => {
  const image = { x: 0, y: 0, width: 400, height: 300 }
  expect(
    coverSelection(image, { x: 350, y: 250, width: 100, height: 100 }),
  ).toEqual({
    x: 50,
    y: 50,
    width: 400,
    height: 300,
  })
  expect(
    coverSelection(image, { x: -20, y: -30, width: 100, height: 100 }),
  ).toEqual({
    ...image,
    x: -20,
    y: -30,
  })
})

it('ingrandisce in proporzione quando il ritaglio supera la foto', () => {
  const selection = { x: 10, y: 20, width: 300, height: 200 }
  const covered = coverSelection(
    { x: 0, y: 0, width: 100, height: 200 },
    selection,
  )
  expect(covered.width).toBe(300)
  expect(covered.height).toBe(600)
  expect(covered.x).toBe(10)
  expect(covered.y).toBeLessThanOrEqual(selection.y)
  expect(covered.y + covered.height).toBeGreaterThanOrEqual(
    selection.y + selection.height,
  )
})

it('traduce zoom e spostamento nei pixel originali usati dalla compressione', () => {
  const crop = cropFromRects(
    { x: -100, y: -50, width: 800, height: 600 },
    { x: 100, y: 100, width: 400, height: 300 },
  )
  expect(crop).toEqual({ left: 25, top: 25, right: 25, bottom: 25 })
  expect(cropBounds(1600, 1200, crop)).toEqual({
    x: 400,
    y: 300,
    width: 800,
    height: 600,
  })
})

it('mantiene tutta la foto iniziale senza imporre un rapporto o tagliare le scritte', () => {
  for (const source of [
    { width: 4000, height: 3000 },
    { width: 3000, height: 4000 },
    { width: 80, height: 60 },
  ]) {
    const { image, selection } = layoutCrop(noCrop, source, {
      width: 300,
      height: 320,
    })
    expect(image.width / image.height).toBeCloseTo(source.width / source.height)
    const restored = cropFromRects(image, selection)
    for (const margin of Object.values(restored)) expect(margin).toBeCloseTo(0)
  }
})

it('ingrandisce il ritaglio nell’anteprima senza cambiare i margini dopo resize o cambio viewport', () => {
  const crop = { left: 70, top: 15, right: 10, bottom: 30 }
  for (const viewport of [
    { width: 240, height: 320 },
    { width: 768, height: 250 },
  ]) {
    const { image, selection } = layoutCrop(
      crop,
      { width: 4000, height: 3000 },
      viewport,
    )
    expect(selection.x).toBeGreaterThanOrEqual(8)
    expect(selection.y).toBeGreaterThanOrEqual(8)
    expect(selection.x + selection.width).toBeLessThanOrEqual(
      viewport.width - 8 + 0.001,
    )
    expect(selection.y + selection.height).toBeLessThanOrEqual(
      viewport.height - 8 + 0.001,
    )
    const restored = cropFromRects(image, selection)
    for (const margin of ['left', 'top', 'right', 'bottom'] as const)
      expect(restored[margin]).toBeCloseTo(crop[margin])
  }
})

it('non lascia bordi vuoti per immagini verticali, panorami e spostamenti estremi', () => {
  for (const aspect of [0.2, 0.75, 1, 1.5, 5]) {
    for (const offset of [-1000, -20, 0, 50, 1000]) {
      const selection = { x: 10, y: 20, width: 220, height: 200 }
      const covered = coverSelection(
        { x: offset, y: offset, width: 100 * aspect, height: 100 },
        selection,
      )
      expect(covered.width / covered.height).toBeCloseTo(aspect)
      expect(covered.x).toBeLessThanOrEqual(selection.x + 0.001)
      expect(covered.y).toBeLessThanOrEqual(selection.y + 0.001)
      expect(covered.x + covered.width).toBeGreaterThanOrEqual(
        selection.x + selection.width - 0.001,
      )
      expect(covered.y + covered.height).toBeGreaterThanOrEqual(
        selection.y + selection.height - 0.001,
      )
    }
  }
})
