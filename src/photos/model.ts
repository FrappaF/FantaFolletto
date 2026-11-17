import { validDay, validDate } from '../domain/validation'

export type Doormat = {
  id: string
  createdBy: string
  createdAt: string
  day: string
  caption: string
  width: number
  height: number
  mime: 'image/jpeg' | 'image/webp'
  bytes: number
  thumbnailBytes: number
  digest: string
  thumbnailDigest: string
  status: 'uploading' | 'ready' | 'removed'
}
export type PhotoFiles = { photo: Blob; thumbnail: Blob }
export type PhotoOperation = {
  type: 'upload' | 'remove'
  photo: Doormat
  error?: string
}
export type PhotoCache = {
  version: 1
  items: Doormat[]
  queue: PhotoOperation[]
}
export type PhotoTransport = {
  list: () => Promise<Doormat[]>
  upload: (photo: Doormat, files: PhotoFiles) => Promise<void>
  remove: (photo: Doormat) => Promise<void>
  download: (photo: Doormat, thumbnail: boolean) => Promise<Blob>
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash = /^[0-9a-f]{64}$/
export function parseDoormat(value: unknown): Doormat {
  const p = value as Doormat
  if (
    !p ||
    !uuid.test(p.id) ||
    !uuid.test(p.createdBy) ||
    !validDay(p.day) ||
    !validDate(p.createdAt) ||
    typeof p.caption !== 'string' ||
    p.caption.length > 300 ||
    !['image/jpeg', 'image/webp'].includes(p.mime) ||
    !['uploading', 'ready', 'removed'].includes(p.status) ||
    !hash.test(p.digest) ||
    !hash.test(p.thumbnailDigest) ||
    !Number.isSafeInteger(p.width) ||
    p.width < 1 ||
    p.width > 1600 ||
    !Number.isSafeInteger(p.height) ||
    p.height < 1 ||
    p.height > 1600 ||
    !Number.isSafeInteger(p.bytes) ||
    p.bytes < 1 ||
    p.bytes > 1_000_000 ||
    !Number.isSafeInteger(p.thumbnailBytes) ||
    p.thumbnailBytes < 1 ||
    p.thumbnailBytes > 100_000
  )
    throw new Error(
      'Foto non compatibile. I dati sul telefono sono conservati.',
    )
  return p
}
export function objectPath(photo: Doormat, thumbnail: boolean) {
  return `${photo.createdBy}/${photo.id}/${thumbnail ? 'thumb-' + photo.thumbnailDigest : 'photo-' + photo.digest}`
}
export async function digest(blob: Blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}
export const formatBytes = (bytes: number) =>
  bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} kB`
    : `${(bytes / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`
