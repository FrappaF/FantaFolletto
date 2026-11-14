import type { DailyNote, Diary, Entry, SurnameCombo } from '../domain/model'

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
  | { type: 'add-combo'; combo: SurnameCombo }
  | { type: 'remove-combo'; comboId: string; at: string }
  | { type: 'add-note'; note: DailyNote }
  | { type: 'remove-note'; noteId: string; at: string }
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
    } else if (operation.type === 'void') {
      if (operation.status === 'pending')
        diary.entries = diary.entries.map((entry) =>
          entry.id === operation.entryId
            ? { ...entry, voidedAt: operation.at, sync: 'pending' }
            : entry,
        )
    } else if (operation.type === 'add-combo') {
      diary.combos ??= []
      if (!diary.combos.some((item) => item.id === operation.combo.id))
        diary.combos.push({
          ...operation.combo,
          sync: operation.status === 'blocked' ? 'error' : 'pending',
        })
    } else if (
      operation.type === 'remove-combo' &&
      operation.status === 'pending'
    ) {
      diary.combos = diary.combos?.map((item) =>
        item.id === operation.comboId
          ? { ...item, removedAt: operation.at, sync: 'pending' }
          : item,
      )
    } else if (operation.type === 'add-note') {
      diary.notes ??= []
      if (!diary.notes.some((item) => item.id === operation.note.id))
        diary.notes.push({
          ...operation.note,
          sync: operation.status === 'blocked' ? 'error' : 'pending',
        })
    } else if (
      operation.type === 'remove-note' &&
      operation.status === 'pending'
    ) {
      diary.notes = diary.notes?.map((item) =>
        item.id === operation.noteId
          ? { ...item, removedAt: operation.at, sync: 'pending' }
          : item,
      )
    }
  }
  return diary
}
