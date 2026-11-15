import type { AccountCache } from './types'
import { parseDiary, validDate } from '../domain/validation'

const DB_NAME = 'fantafolletto-accounts'
let database: Promise<IDBDatabase> | undefined
const fresh = (): AccountCache => ({ schemaVersion: 1, queue: [] })

export function accountKey(projectUrl: string, userId: string) {
  return `${new URL(projectUrl).origin}:${userId}`
}

function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    let abandoned = false
    request.onupgradeneeded = () => request.result.createObjectStore('accounts')
    request.onblocked = () => {
      abandoned = true
      reject(new Error('Chiudi le altre schede dell’app e riprova.'))
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      if (abandoned) {
        request.result.close()
        return
      }
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

export async function updateAccount(
  key: string,
  change: (value: AccountCache) => AccountCache,
): Promise<AccountCache> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite')
    const store = tx.objectStore('accounts')
    const request = store.get(key)
    let result: AccountCache
    let failure: unknown
    request.onsuccess = () => {
      try {
        const value = request.result === undefined ? fresh() : request.result
        if (
          value?.schemaVersion !== 1 ||
          !Array.isArray(value.queue) ||
          (value.snapshot && value.snapshot.schemaVersion !== 1)
        )
          throw new Error(
            'Dati locali non compatibili. Sono stati conservati: non cancellare lo spazio del sito.',
          )
        if (value.snapshot) {
          parseDiary(value.snapshot)
          if (
            !['admin', 'player'].includes(value.snapshot.role) ||
            typeof value.snapshot.ownerId !== 'string' ||
            !validDate(value.snapshot.fetchedAt)
          )
            throw new Error(
              'Diario locale non compatibile. I dati sono conservati.',
            )
        }
        for (const operation of value.queue) {
          if (
            !operation ||
            typeof operation.operationId !== 'string' ||
            !['pending', 'blocked'].includes(operation.status)
          )
            throw new Error(
              'Coda locale non compatibile. I dati sono conservati.',
            )
          if (operation.type === 'redeem-reward') {
            if (
              typeof operation.rewardId !== 'string' ||
              !Number.isSafeInteger(operation.expectedVersion) ||
              operation.expectedVersion < 1 ||
              !(
                operation.periodKey === 'all' ||
                /^\d{4}-\d{2}-\d{2}$/.test(operation.periodKey)
              )
            )
              throw new Error(
                'Riscatto locale non compatibile. I dati sono conservati.',
              )
          } else if (operation.type === 'record')
            parseDiary({
              schemaVersion: 1,
              events: [],
              rewards: [],
              entries: [operation.entry],
            })
          else if (operation.type === 'add-combo')
            parseDiary({
              schemaVersion: 1,
              events: [],
              rewards: [],
              entries: [],
              combos: [operation.combo],
            })
          else if (operation.type === 'add-note')
            parseDiary({
              schemaVersion: 1,
              events: [],
              rewards: [],
              entries: [],
              notes: [operation.note],
            })
          else if (operation.type === 'remove-note') {
            if (
              typeof operation.noteId !== 'string' ||
              !validDate(operation.at)
            )
              throw new Error(
                'Operazione locale non compatibile. I dati sono conservati.',
              )
          } else if (operation.type === 'remove-combo') {
            if (
              typeof operation.comboId !== 'string' ||
              !validDate(operation.at)
            )
              throw new Error(
                'Operazione locale non compatibile. I dati sono conservati.',
              )
          } else if (
            operation.type !== 'void' ||
            typeof operation.entryId !== 'string' ||
            !validDate(operation.at)
          )
            throw new Error(
              'Operazione locale non compatibile. I dati sono conservati.',
            )
        }
        result = change(value)
        store.put(result, key)
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
          new Error('Il salvataggio sul telefono non è riuscito.'),
      )
  })
}

export const readAccount = (key: string) => updateAccount(key, (value) => value)

export async function enqueue(
  key: string,
  operation: AccountCache['queue'][number],
) {
  return updateAccount(key, (value) => {
    const existing = value.queue.find(
      (item) => item.operationId === operation.operationId,
    )
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(operation))
        throw new Error('Operazione locale già usata con dati diversi.')
      return value
    }
    return { ...value, queue: [...value.queue, operation] }
  })
}
