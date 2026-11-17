import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  digest,
  objectPath,
  parseDoormat,
  type Doormat,
  type PhotoTransport,
} from './model'
import {
  addLocalPhoto,
  readPhotoFiles,
  readPhotos,
  removeLocalPhoto,
  updatePhotos,
} from './store'
import { synchronizePhotos } from './sync'
import { cropBounds, scaledSize } from './image'

const files = {
  photo: new Blob(['foto'], { type: 'image/jpeg' }),
  thumbnail: new Blob(['miniatura'], { type: 'image/jpeg' }),
}
async function photo(): Promise<Doormat> {
  return {
    id: randomUUID(),
    createdBy: randomUUID(),
    caption: 'Un sorriso',
    day: '2026-11-17',
    createdAt: '2026-11-17T12:00:00Z',
    width: 1200,
    height: 800,
    bytes: files.photo.size,
    thumbnailBytes: files.thumbnail.size,
    digest: await digest(files.photo),
    thumbnailDigest: await digest(files.thumbnail),
    mime: 'image/jpeg',
    status: 'uploading',
  }
}
it('ridimensiona senza ingrandire né deformare e mantiene ritagli non vuoti', () => {
  expect(scaledSize(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
  expect(scaledSize(300, 600, 1600)).toEqual({ width: 300, height: 600 })
  expect(
    cropBounds(1600, 1200, { left: 10, right: 10, top: 0, bottom: 25 }),
  ).toEqual({ x: 160, y: 0, width: 1280, height: 900 })
  expect(() =>
    cropBounds(100, 100, { left: NaN, right: 0, top: 0, bottom: 0 }),
  ).toThrow()
})
it('salva Blob e richiesta insieme, rilegge dopo riapertura e isola account/progetti/demo', async () => {
  const p = await photo()
  const scope = randomUUID()
  await addLocalPhoto(scope, p, files, true)
  const saved = await readPhotos(scope)
  expect(saved.queue).toHaveLength(1)
  expect(await (await readPhotoFiles(scope, p.id))!.photo.text()).toBe('foto')
  expect((await readPhotos('altro:' + scope)).items).toEqual([])
  expect(await readPhotoFiles('demo', p.id)).toBeUndefined()
  await expect(addLocalPhoto(scope, p, files, true)).rejects.toThrow(
    /già salvata/,
  )
  expect((await readPhotos(scope)).items).toHaveLength(1)
})
it('non azzera archivi incompatibili e rifiuta metadati/file fuori limite', async () => {
  const p = await photo()
  expect(() => parseDoormat({ ...p, bytes: 1_000_001 })).toThrow()
  expect(() => parseDoormat({ ...p, day: '2026-02-30' })).toThrow()
  expect(objectPath(p, false)).toContain(`/photo-${p.digest}`)
  const scope = randomUUID()
  await expect(
    updatePhotos(scope, (v) => ({ ...v, version: 7 }) as never),
  ).rejects.toThrow(/conservati/)
  await expect(
    addLocalPhoto(scope, { ...p, bytes: 200 }, files, true),
  ).rejects.toThrow(/corrispondono/)
  expect((await readPhotos(scope)).items).toEqual([])
})
it('ritenta lo stesso invio ambiguo, conserva Blob ed errore e continua con altre foto', async () => {
  const scope = randomUUID()
  const first = await photo(),
    second = await photo()
  await addLocalPhoto(scope, first, files, true)
  await addLocalPhoto(scope, second, files, true)
  let committed = false
  let attempts = 0
  const transport: PhotoTransport = {
    list: async () => [
      { ...first, status: 'ready' },
      { ...second, status: 'ready' },
    ],
    upload: vi.fn(async (p) => {
      if (p.id === first.id && attempts++ === 0) {
        committed = true
        throw new Error('Timeout dopo upload')
      }
      expect(committed).toBe(true)
    }),
    remove: vi.fn(),
    download: vi.fn(),
  }
  await synchronizePhotos(scope, transport, () => {})
  expect((await readPhotos(scope)).queue[0]).toMatchObject({
    photo: { id: first.id },
    error: 'Timeout dopo upload',
  })
  expect(await readPhotoFiles(scope, first.id)).toBeTruthy()
  expect(await readPhotoFiles(scope, second.id)).toBeUndefined()
  await synchronizePhotos(scope, transport, () => {})
  expect((await readPhotos(scope)).queue).toEqual([])
  expect(await readPhotoFiles(scope, first.id)).toBeUndefined()
  expect(transport.upload).toHaveBeenCalledTimes(3)
})
it('rimuove una foto ancora in coda senza caricarla e riprende la pulizia interrotta', async () => {
  const p = await photo(),
    scope = randomUUID()
  await addLocalPhoto(scope, p, files, true)
  await removeLocalPhoto(scope, p, true)
  const transport: PhotoTransport = {
    list: async () => [{ ...p, status: 'removed' }],
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi
      .fn()
      .mockRejectedValueOnce(new Error('Pulizia interrotta'))
      .mockResolvedValue(undefined),
  }
  await synchronizePhotos(scope, transport, () => {})
  expect((await readPhotos(scope)).queue).toHaveLength(2)
  expect(await readPhotoFiles(scope, p.id)).toBeTruthy()
  await synchronizePhotos(scope, transport, () => {})
  expect(transport.upload).not.toHaveBeenCalled()
  expect((await readPhotos(scope)).queue).toHaveLength(0)
  expect((await readPhotos(scope)).items[0].status).toBe('removed')
  expect(await readPhotoFiles(scope, p.id)).toBeUndefined()
})
