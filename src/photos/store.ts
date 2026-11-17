import {
  parseDoormat,
  type Doormat,
  type PhotoCache,
  type PhotoFiles,
  type PhotoOperation,
} from './model'

let database: Promise<IDBDatabase> | undefined
const fresh = (): PhotoCache => ({ version: 1, items: [], queue: [] })
function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('fantafolletto-photos', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('scopes')
      request.result.createObjectStore('files')
    }
    request.onblocked = () =>
      reject(new Error('Chiudi le altre schede dell’app e riprova.'))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        database = undefined
      }
      resolve(request.result)
    }
  }).catch((error) => {
    database = undefined
    throw error
  })
  return database
}
function parse(value: PhotoCache | undefined) {
  if (!value) return fresh()
  if (
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.queue)
  )
    throw new Error('Archivio foto non compatibile. I dati sono conservati.')
  value.items.forEach(parseDoormat)
  for (const op of value.queue) {
    if (!['upload', 'remove'].includes(op.type))
      throw new Error('Coda foto non compatibile. I dati sono conservati.')
    parseDoormat(op.photo)
  }
  return value
}
export async function updatePhotos(
  scope: string,
  change: (cache: PhotoCache) => PhotoCache,
  files?: { id: string; value?: PhotoFiles },
) {
  const db = await open()
  return new Promise<PhotoCache>((resolve, reject) => {
    const tx = db.transaction(['scopes', 'files'], 'readwrite')
    const store = tx.objectStore('scopes')
    const request = store.get(scope)
    let result: PhotoCache
    let failure: unknown
    request.onsuccess = () => {
      try {
        result = parse(change(parse(request.result)))
        store.put(result, scope)
        if (files) {
          if (files.value)
            tx.objectStore('files').put(files.value, [scope, files.id])
          else tx.objectStore('files').delete([scope, files.id])
        }
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onabort = () =>
      reject(
        failure ??
          tx.error ??
          new Error(
            'Spazio sul telefono insufficiente. La foto non è stata salvata: conserva l’originale e riprova.',
          ),
      )
    tx.onerror = () => {}
  })
}
export const readPhotos = (scope: string) =>
  updatePhotos(scope, (value) => value)
export async function readPhotoFiles(scope: string, id: string) {
  const db = await open()
  return new Promise<PhotoFiles | undefined>((resolve, reject) => {
    const tx = db.transaction('files')
    const request = tx.objectStore('files').get([scope, id])
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = () => reject(tx.error)
  })
}
export function mergePhotos(cache: PhotoCache, items: Doormat[]): PhotoCache {
  items.forEach(parseDoormat)
  const queued = new Set(cache.queue.map((op) => op.photo.id))
  return {
    ...cache,
    items: [
      ...items.filter((p) => !queued.has(p.id)),
      ...cache.items.filter((p) => queued.has(p.id)),
    ],
  }
}
export async function addLocalPhoto(
  scope: string,
  photo: Doormat,
  files: PhotoFiles,
  shared: boolean,
) {
  if (
    files.photo.size !== photo.bytes ||
    files.thumbnail.size !== photo.thumbnailBytes ||
    files.photo.type !== photo.mime ||
    files.thumbnail.type !== photo.mime
  )
    throw new Error('I file non corrispondono alla foto da salvare.')
  return updatePhotos(
    scope,
    (value) => {
      if (value.items.some((p) => p.id === photo.id))
        throw new Error('Questa foto è già salvata.')
      return {
        ...value,
        items: [...value.items, photo],
        queue: shared
          ? [...value.queue, { type: 'upload', photo }]
          : value.queue,
      }
    },
    { id: photo.id, value: files },
  )
}
export async function removeLocalPhoto(
  scope: string,
  photo: Doormat,
  shared: boolean,
) {
  return updatePhotos(
    scope,
    (value) => ({
      ...value,
      items: value.items.map((p) =>
        p.id === photo.id ? { ...p, status: 'removed' } : p,
      ),
      queue:
        shared &&
        !value.queue.some(
          (op) => op.type === 'remove' && op.photo.id === photo.id,
        )
          ? [...value.queue, { type: 'remove', photo }]
          : value.queue,
    }),
    shared ? undefined : { id: photo.id },
  )
}
export const operationKey = (op: PhotoOperation) => `${op.type}:${op.photo.id}`
