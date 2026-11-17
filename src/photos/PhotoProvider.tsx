import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { newId } from '../domain/ids'
import {
  digest,
  type Doormat,
  type PhotoCache,
  type PhotoTransport,
} from './model'
import type { ProcessedPhoto } from './image'
import {
  addLocalPhoto,
  readPhotoFiles,
  readPhotos,
  removeLocalPhoto,
} from './store'
import { synchronizePhotos } from './sync'

export type PhotoConnection = {
  scope: string
  userId: string
  transport: PhotoTransport
}
const demoUser = '00000000-0000-4000-8000-000000000001'
function usePhotoController(connection?: PhotoConnection) {
  const scope = connection?.scope ?? 'demo'
  const [cache, setCache] = useState<PhotoCache>({
    version: 1,
    items: [],
    queue: [],
  })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const mounted = useRef(false)
  const saving = useRef(false)
  const syncingRef = useRef(false)
  const channel = useRef<BroadcastChannel | undefined>(undefined)
  const load = useCallback(async () => {
    const value = await readPhotos(scope)
    if (mounted.current) {
      setCache(value)
      setReady(true)
    }
  }, [scope])
  const refresh = useCallback(async () => {
    if (!mounted.current || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      await load()
      if (connection)
        await synchronizePhotos(
          scope,
          connection.transport,
          () => {
            channel.current?.postMessage('changed')
            void load().catch(() => {})
          },
          () => mounted.current,
        )
      if (mounted.current) setError('')
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : 'La raccolta foto non è raggiungibile.',
        )
    } finally {
      syncingRef.current = false
      if (mounted.current) setSyncing(false)
    }
  }, [connection, load, scope])
  useEffect(() => {
    mounted.current = true
    void refresh()
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel(`fantafolletto-photos:${scope}`)
      channel.current.onmessage = () => {
        void load().catch(() => {})
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', visible)
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(visible, 30000)
    return () => {
      mounted.current = false
      channel.current?.close()
      channel.current = undefined
      window.clearInterval(timer)
      window.removeEventListener('online', visible)
      window.removeEventListener('focus', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [load, refresh, scope])
  async function change(action: () => Promise<PhotoCache>) {
    if (saving.current) return false
    saving.current = true
    setBusy(true)
    setError('')
    try {
      const next = await action()
      if (mounted.current) setCache(next)
      channel.current?.postMessage('changed')
      return true
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error ? error.message : 'Foto non salvata. Riprova.',
        )
      return false
    } finally {
      saving.current = false
      if (mounted.current) setBusy(false)
      // Refetch in progress may have captured the previous queue. The next tick
      // or visibility event also retries the durable operation if necessary.
      void refresh()
    }
  }
  return {
    ...cache,
    ready,
    error,
    busy,
    syncing,
    scope,
    shared: !!connection,
    refresh,
    add: (processed: ProcessedPhoto, day: string, caption: string) =>
      change(async () => {
        const photo: Doormat = {
          id: newId(),
          createdBy: connection?.userId ?? demoUser,
          createdAt: new Date().toISOString(),
          day,
          caption: caption.trim(),
          width: processed.width,
          height: processed.height,
          mime: processed.mime,
          bytes: processed.photo.size,
          thumbnailBytes: processed.thumbnail.size,
          digest: await digest(processed.photo),
          thumbnailDigest: await digest(processed.thumbnail),
          status: connection ? 'uploading' : 'ready',
        }
        return addLocalPhoto(scope, photo, processed, !!connection)
      }),
    remove: (photo: Doormat) =>
      change(() => removeLocalPhoto(scope, photo, !!connection)),
    getImage: async (photo: Doormat, thumbnail: boolean) => {
      const files = await readPhotoFiles(scope, photo.id)
      if (files) return thumbnail ? files.thumbnail : files.photo
      if (connection) return connection.transport.download(photo, thumbnail)
      throw new Error('Questa foto non è più disponibile sul dispositivo.')
    },
  }
}
type PhotoController = ReturnType<typeof usePhotoController>
const Context = createContext<PhotoController | undefined>(undefined)
export function PhotoProvider({
  connection,
  children,
}: {
  connection?: PhotoConnection
  children: ReactNode
}) {
  const photos = usePhotoController(connection)
  return (
    <Context.Provider value={photos}>
      <div
        data-update-blocked={
          photos.busy || photos.syncing || photos.queue.length > 0
            ? 'true'
            : 'false'
        }
      >
        {children}
      </div>
    </Context.Provider>
  )
}
export function usePhotos() {
  const photos = useContext(Context)
  if (!photos) throw new Error('Raccolta foto non inizializzata.')
  return photos
}
