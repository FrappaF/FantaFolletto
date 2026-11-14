import { parseDiary } from '../domain/validation'
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
  return parseDiary(value)
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
