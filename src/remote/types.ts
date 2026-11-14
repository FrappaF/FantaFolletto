import type { Diary, Entry } from '../domain/model'

export type RemoteSnapshot = Diary & {
  role: 'player' | 'admin'
  ownerId: string
  fetchedAt: string
}
export type QueuedOperation = {
  operationId: string
  status: 'pending' | 'blocked'
  error?: string
} & (
  | { type: 'record'; entry: Entry }
  | { type: 'void'; entryId: string; at: string }
)

export type AccountCache = {
  schemaVersion: 1
  snapshot?: RemoteSnapshot
  queue: QueuedOperation[]
}

export class RemoteError extends Error {
  code: string
  constructor(message: string, code = '') {
    super(message)
    this.code = code
  }
}

export function isPermanent(error: unknown) {
  return (
    error instanceof RemoteError &&
    (/^(22|23)/.test(error.code) ||
      ['42501', '40001', 'P0001'].includes(error.code))
  )
}

export function projectDiary(cache: AccountCache): RemoteSnapshot | undefined {
  if (!cache.snapshot) return undefined
  const diary = structuredClone(cache.snapshot)
  for (const operation of cache.queue) {
    if (operation.type === 'record') {
      if (!diary.entries.some((entry) => entry.id === operation.entry.id)) {
        diary.entries.push({
          ...operation.entry,
          sync: operation.status === 'blocked' ? 'error' : 'pending',
        })
      }
    } else {
      if (operation.status === 'pending')
        diary.entries = diary.entries.map((entry) =>
          entry.id === operation.entryId
            ? { ...entry, voidedAt: operation.at, sync: 'pending' }
            : entry,
        )
    }
  }
  return diary
}
