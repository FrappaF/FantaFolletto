import type { PhotoTransport } from './model'
import {
  mergePhotos,
  operationKey,
  readPhotoFiles,
  readPhotos,
  updatePhotos,
} from './store'

const running = new Map<string, Promise<void>>()
export function synchronizePhotos(
  scope: string,
  transport: PhotoTransport,
  changed: () => void,
  active = () => true,
): Promise<void> {
  if (running.has(scope)) return running.get(scope)!
  const work = async () => {
    // Photos have their own queue: a failing image never blocks diary operations.
    const { queue } = await readPhotos(scope)
    for (const op of queue) {
      if (!active()) return
      const current = await readPhotos(scope)
      if (!current.queue.some((p) => operationKey(p) === operationKey(op)))
        continue
      if (
        op.type === 'upload' &&
        current.queue.some(
          (p) => p.type === 'remove' && p.photo.id === op.photo.id,
        )
      )
        continue
      try {
        if (op.type === 'upload') {
          const files = await readPhotoFiles(scope, op.photo.id)
          if (!files)
            throw new Error(
              'La foto non è più disponibile sul telefono. Rimuovi l’invio e scegli di nuovo l’originale.',
            )
          await transport.upload(op.photo, files)
        } else await transport.remove(op.photo)
        await updatePhotos(
          scope,
          (value) => ({
            ...value,
            items: value.items.map((p) =>
              p.id === op.photo.id
                ? {
                    ...p,
                    status:
                      op.type === 'remove' || p.status === 'removed'
                        ? 'removed'
                        : 'ready',
                  }
                : p,
            ),
            queue: value.queue.filter((p) =>
              op.type === 'remove'
                ? p.photo.id !== op.photo.id
                : operationKey(p) !== operationKey(op),
            ),
          }),
          { id: op.photo.id },
        ) // Release uploaded full images; galleries fetch on demand.
      } catch (error) {
        await updatePhotos(scope, (value) => ({
          ...value,
          queue: value.queue.map((p) =>
            operationKey(p) === operationKey(op)
              ? {
                  ...p,
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Invio non riuscito. Riprova online.',
                }
              : p,
          ),
        }))
      }
      changed()
    }
    if (!active()) return
    const items = await transport.list()
    await updatePhotos(scope, (cache) => mergePhotos(cache, items))
    changed()
  }
  const promise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks)
      await navigator.locks.request(`fantafolletto-photo-sync:${scope}`, work)
    else await work()
  })().finally(() => running.delete(scope))
  running.set(scope, promise)
  return promise
}
