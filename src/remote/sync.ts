import { readAccount, updateAccount } from './account-store'
import { isPermanent, type QueuedOperation, type RemoteSnapshot } from './types'

export type SyncTransport = {
  snapshot: () => Promise<RemoteSnapshot>
  send: (operation: QueuedOperation) => Promise<void>
}

export async function synchronize(
  key: string,
  transport: SyncTransport,
  changed: () => void = () => {},
  isActive: () => boolean = () => true,
) {
  const work = async () => {
    // Server acknowledgment and the latest snapshot are persisted together.
    const initial = await transport.snapshot()
    await updateAccount(key, (value) => ({ ...value, snapshot: initial }))
    changed()
    const { queue } = await readAccount(key)
    for (const queued of queue) {
      if (!isActive()) return
      const latest = await readAccount(key)
      const operation = latest.queue.find(
        (item) => item.operationId === queued.operationId,
      )
      if (!operation || operation.status === 'blocked') continue
      if (
        operation.type === 'void' &&
        latest.queue.some(
          (item) =>
            item.type === 'record' && item.entry.id === operation.entryId,
        )
      )
        continue
      try {
        await transport.send(operation)
        const snapshot = await transport.snapshot()
        await updateAccount(key, (value) => ({
          ...value,
          snapshot,
          queue: value.queue.filter(
            (item) => item.operationId !== operation.operationId,
          ),
        }))
      } catch (error) {
        if (!isPermanent(error)) throw error
        await updateAccount(key, (value) => ({
          ...value,
          queue: value.queue.map((item) =>
            item.operationId === operation.operationId
              ? {
                  ...item,
                  status: 'blocked',
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Inserimento da correggere.',
                }
              : item,
          ),
        }))
      }
      changed()
    }
  }
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request(
      `fantafolletto-sync:${key}`,
      { ifAvailable: true },
      async (lock) => {
        if (lock) await work()
      },
    )
  } else await work() // Idempotent RPCs are also safe on browsers without Web Locks.
}
