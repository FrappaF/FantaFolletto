import {
  applyCommand,
  initialDiary,
  type Command,
  type Diary,
} from '../domain/model'

const DB_NAME = 'fantafolletto-demo'
const STORE = 'diary'
const KEY = 'local-demo'
let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error('Chiudi le altre schede della demo e riprova.'))
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          database = undefined
        }
        resolve(db)
      }
    }).catch((error) => {
      database = undefined
      throw error
    })
  }
  return database
}

// Never replace an unreadable diary with an empty one.
function readState(value: unknown): Diary {
  if (value === undefined) return initialDiary()
  const state = value as Diary
  const text = (value: unknown, max: number, required = true): boolean =>
    typeof value === 'string' &&
    (!required || value.trim().length > 0) &&
    value.length <= max
  const number = (value: unknown, min: number, max: number): boolean =>
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  const date = (value: unknown): boolean =>
    typeof value === 'string' && Number.isFinite(Date.parse(value))
  const uniqueIds = (values: { id: string }[]) =>
    new Set(values.map((item) => item.id)).size === values.length
  const valid =
    state?.schemaVersion === 1 &&
    Array.isArray(state.events) &&
    Array.isArray(state.entries) &&
    Array.isArray(state.rewards) &&
    state.events.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.name, 60) &&
        text(item.description, 180, false) &&
        number(item.points, -1000, 1000) &&
        number(item.version, 1, Number.MAX_SAFE_INTEGER) &&
        typeof item.archived === 'boolean',
    ) &&
    state.rewards.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.name, 60) &&
        text(item.description, 180, false) &&
        number(item.target, 1, 100000) &&
        ['week', 'all'].includes(item.period) &&
        typeof item.archived === 'boolean',
    ) &&
    state.entries.every(
      (item) =>
        item &&
        text(item.id, 100) &&
        text(item.eventId, 100) &&
        text(item.name, 60) &&
        number(item.points, -1000, 1000) &&
        number(item.eventVersion, 1, Number.MAX_SAFE_INTEGER) &&
        date(item.occurredAt) &&
        (item.voidedAt === undefined || date(item.voidedAt)),
    ) &&
    uniqueIds(state.events) &&
    uniqueIds(state.rewards) &&
    uniqueIds(state.entries)
  if (!valid) {
    throw new Error(
      'Il diario salvato non è compatibile. I dati sono stati conservati: non cancellare lo spazio del sito.',
    )
  }
  return state
}

export async function readDiary(): Promise<Diary> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.get(KEY)
    let result: Diary
    let failure: unknown
    request.onsuccess = () => {
      try {
        result = readState(request.result)
        if (request.result === undefined) store.put(result, KEY)
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onabort = () =>
      reject(failure ?? tx.error ?? new Error('Impossibile leggere il diario.'))
    tx.onerror = () => {
      /* onabort reports failed requests */
    }
  })
}

export async function saveCommand(command: Command): Promise<Diary> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    // Read and update in one transaction, so concurrent tabs cannot overwrite each other.
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.get(KEY)
    let result: Diary
    let failure: unknown
    request.onsuccess = () => {
      try {
        result = applyCommand(readState(request.result), command)
        store.put(result, KEY)
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onabort = () =>
      reject(
        failure ?? tx.error ?? new Error('Salvataggio non riuscito. Riprova.'),
      )
    tx.onerror = () => {
      /* preserve the transaction error */
    }
  })
}
