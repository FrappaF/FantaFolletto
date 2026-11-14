import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { readDiary, saveCommand } from './diary-store'

describe('persistenza IndexedDB della demo', () => {
  it('conferma il salvataggio solo dopo la transazione e rilegge i dati', async () => {
    expect((await readDiary()).entries).toHaveLength(0)
    await saveCommand({
      type: 'record',
      eventId: 'coffee',
      id: 'persisted',
      at: '2026-11-14T10:00:00Z',
    })
    expect(
      (await readDiary()).entries.find((entry) => entry.id === 'persisted')
        ?.points,
    ).toBe(10)
  })

  it('due scritture concorrenti non si sovrascrivono', async () => {
    await Promise.all([
      saveCommand({
        type: 'record',
        eventId: 'coffee',
        id: 'concurrent-a',
        at: '2026-11-14T10:00:00Z',
      }),
      saveCommand({
        type: 'record',
        eventId: 'pet',
        id: 'concurrent-b',
        at: '2026-11-14T10:00:00Z',
      }),
    ])
    const state = await readDiary()
    expect(state.entries.some((entry) => entry.id === 'concurrent-a')).toBe(
      true,
    )
    expect(state.entries.some((entry) => entry.id === 'concurrent-b')).toBe(
      true,
    )
  })

  it('un comando rifiutato non altera il diario salvato', async () => {
    const before = await readDiary()
    await expect(
      saveCommand({
        type: 'record',
        eventId: 'missing',
        id: 'rejected',
        at: '2026-11-14T10:00:00Z',
      }),
    ).rejects.toThrow(/non è più disponibile/)
    expect(await readDiary()).toEqual(before)
  })

  it('un ritentativo concorrente è acquisito una sola volta', async () => {
    const command = {
      type: 'record',
      eventId: 'coffee',
      id: 'retry',
      at: '2026-11-14T10:00:00Z',
    } as const
    await Promise.all([saveCommand(command), saveCommand(command)])
    expect(
      (await readDiary()).entries.filter((entry) => entry.id === 'retry'),
    ).toHaveLength(1)
  })

  it('dati incompatibili non vengono azzerati né sovrascritti', async () => {
    const corrupted = {
      schemaVersion: 1,
      events: [null],
      rewards: [],
      entries: [],
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fantafolletto-demo', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('diary', 'readwrite')
      tx.objectStore('diary').put(corrupted, 'local-demo')
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
    })
    await expect(readDiary()).rejects.toThrow(/conservati/)
    await expect(
      saveCommand({ type: 'void', id: 'retry', at: '2026-11-14T10:00:00Z' }),
    ).rejects.toThrow(/conservati/)
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction('diary')
        .objectStore('diary')
        .get('local-demo')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(stored).toEqual(corrupted)
    db.close()
  })
})
