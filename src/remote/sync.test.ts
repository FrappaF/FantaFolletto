import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { initialDiary } from '../domain/model'
import { statistics } from '../domain/stats'
import {
  accountKey,
  enqueue,
  readAccount,
  updateAccount,
} from './account-store'
import { synchronize, type SyncTransport } from './sync'
import {
  projectDiary,
  RemoteError,
  type QueuedOperation,
  type RemoteSnapshot,
} from './types'

const snapshot = (): RemoteSnapshot => ({
  ...initialDiary(),
  role: 'player',
  ownerId: 'alice',
  fetchedAt: new Date().toISOString(),
  awards: [],
})
const operation = (id: string): QueuedOperation => ({
  type: 'record',
  operationId: id,
  status: 'pending',
  entry: {
    id,
    eventId: 'coffee',
    eventVersion: 1,
    name: 'Un caffè offerto',
    points: 10,
    occurredAt: new Date().toISOString(),
  },
})
async function seed(key: string) {
  await updateAccount(key, () => ({
    schemaVersion: 1,
    snapshot: snapshot(),
    queue: [],
  }))
}

describe('coda offline e riconciliazione', () => {
  it('persiste le note per account e le riconcilia dopo timeout senza doppioni', async () => {
    const key = 'note-timeout'
    await seed(key)
    const note = {
      id: 'daily',
      day: '2026-11-14',
      text: 'Una giornata da ricordare',
      createdAt: new Date().toISOString(),
    }
    await enqueue(key, {
      type: 'add-note',
      operationId: note.id,
      status: 'pending',
      note,
    })
    expect(projectDiary(await readAccount(key))?.notes?.[0]).toMatchObject({
      ...note,
      sync: 'pending',
    })
    expect((await readAccount('other-note-account')).queue).toHaveLength(0)
    expect(
      statistics(projectDiary(await readAccount(key))!, new Date()).total,
    ).toBe(0)
    const remote = snapshot()
    let fail = true
    const transport: SyncTransport = {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        if (op.type === 'add-note') {
          remote.notes ??= []
          if (!remote.notes.some((item) => item.id === op.note.id))
            remote.notes.push(op.note)
        }
        if (fail) throw new Error('Timeout')
      },
    }
    await expect(synchronize(key, transport)).rejects.toThrow(/Timeout/)
    expect((await readAccount(key)).queue).toHaveLength(1)
    fail = false
    await synchronize(key, transport)
    expect((await readAccount(key)).queue).toHaveLength(0)
    expect((await readAccount(key)).snapshot?.notes).toHaveLength(1)
  })

  it('non invia la rimozione di una nota rifiutata e non nasconde rimozioni respinte', async () => {
    const key = 'note-rejected'
    await seed(key)
    const note = {
      id: 'rejected-note',
      day: '2026-11-14',
      text: 'Una nota',
      createdAt: new Date().toISOString(),
    }
    await enqueue(key, {
      type: 'add-note',
      operationId: note.id,
      status: 'pending',
      note,
    })
    await enqueue(key, {
      type: 'remove-note',
      operationId: 'remove-note',
      status: 'pending',
      noteId: note.id,
      at: note.createdAt,
    })
    const sent: string[] = []
    await synchronize(key, {
      snapshot: async () => snapshot(),
      send: async (op) => {
        sent.push(op.type)
        throw new RemoteError('Nota rifiutata', '22023')
      },
    })
    expect(sent).toEqual(['add-note'])
    expect((await readAccount(key)).queue.map((op) => op.status)).toEqual([
      'blocked',
      'pending',
    ])
    const remote = snapshot()
    await updateAccount(key, (cache) => ({
      ...cache,
      queue: cache.queue.map((op) => ({ ...op, status: 'pending' })),
    }))
    await synchronize(key, {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        if (op.type === 'add-note') remote.notes = [op.note]
        if (op.type === 'remove-note') remote.notes![0].removedAt = op.at
      },
    })
    expect((await readAccount(key)).queue).toHaveLength(0)
    expect((await readAccount(key)).snapshot?.notes?.[0].removedAt).toBe(
      note.createdAt,
    )
    const projected = projectDiary({
      schemaVersion: 1,
      snapshot: { ...snapshot(), notes: [note] },
      queue: [
        {
          type: 'remove-note',
          operationId: 'bad-remove',
          status: 'blocked',
          noteId: note.id,
          at: note.createdAt,
        },
      ],
    })
    expect(projected?.notes?.[0].removedAt).toBeUndefined()
  })

  it('conserva e riconcilia una combo singola dopo timeout senza duplicarla', async () => {
    const key = 'combo-timeout'
    await seed(key)
    const combo = {
      id: 'single',
      firstSurname: 'Allegri',
      secondSurname: '',
      note: '',
      createdAt: new Date().toISOString(),
    }
    await enqueue(key, {
      type: 'add-combo',
      operationId: combo.id,
      status: 'pending',
      combo,
    })
    const local = await readAccount(key)
    expect(projectDiary(local)?.combos?.[0]).toMatchObject({
      firstSurname: 'Allegri',
      sync: 'pending',
    })
    expect(statistics(projectDiary(local)!, new Date()).total).toBe(0)
    expect((await readAccount('other-combo-account')).queue).toHaveLength(0)
    const remote = snapshot()
    let fail = true
    const transport: SyncTransport = {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        if (op.type === 'add-combo') {
          remote.combos ??= []
          if (!remote.combos.some((item) => item.id === op.combo.id))
            remote.combos.push(op.combo)
        }
        if (fail) throw new Error('Timeout')
      },
    }
    await expect(synchronize(key, transport)).rejects.toThrow(/Timeout/)
    expect((await readAccount(key)).queue).toHaveLength(1)
    fail = false
    await synchronize(key, transport)
    expect((await readAccount(key)).queue).toHaveLength(0)
    expect((await readAccount(key)).snapshot?.combos).toHaveLength(1)
  })

  it('attende la creazione prima di rimuovere una combo e conserva gli errori', async () => {
    const key = 'combo-remove-pending'
    await seed(key)
    const combo = {
      id: 'remove-me',
      firstSurname: 'Belli',
      secondSurname: 'Allegri',
      note: '',
      createdAt: new Date().toISOString(),
    }
    await enqueue(key, {
      type: 'add-combo',
      operationId: combo.id,
      status: 'pending',
      combo,
    })
    await enqueue(key, {
      type: 'remove-combo',
      operationId: 'remove',
      status: 'pending',
      comboId: combo.id,
      at: combo.createdAt,
    })
    const remote = snapshot()
    const sent: string[] = []
    await synchronize(key, {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        sent.push(op.type)
        if (op.type === 'add-combo') throw new RemoteError('Rifiutata', '22023')
      },
    })
    expect(sent).toEqual(['add-combo'])
    expect((await readAccount(key)).queue.map((op) => op.status)).toEqual([
      'blocked',
      'pending',
    ])
    await updateAccount(key, (value) => ({
      ...value,
      queue: value.queue.map((op) => ({ ...op, status: 'pending' })),
    }))
    await synchronize(key, {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        if (op.type === 'add-combo') remote.combos = [op.combo]
        if (op.type === 'remove-combo') remote.combos![0].removedAt = op.at
      },
    })
    expect((await readAccount(key)).queue).toHaveLength(0)
    expect((await readAccount(key)).snapshot?.combos?.[0].removedAt).toBe(
      combo.createdAt,
    )
    const rejectedRemoval = projectDiary({
      schemaVersion: 1,
      snapshot: { ...snapshot(), combos: [combo] },
      queue: [
        {
          type: 'remove-combo',
          operationId: 'rejected',
          status: 'blocked',
          comboId: combo.id,
          at: combo.createdAt,
        },
      ],
    })
    expect(rejectedRemoval?.combos?.[0].removedAt).toBeUndefined()
  })

  it('mantiene operazioni e snapshot tra riaperture e separa account/progetti', async () => {
    const key = accountKey('https://one.supabase.co', 'alice')
    await seed(key)
    await enqueue(key, operation('persisted'))
    expect((await readAccount(key)).queue).toHaveLength(1)
    expect(
      (await readAccount(accountKey('https://one.supabase.co', 'bob'))).queue,
    ).toHaveLength(0)
    expect(
      (await readAccount(accountKey('https://two.supabase.co', 'alice')))
        .snapshot,
    ).toBeUndefined()
    const diary = projectDiary(await readAccount(key))!
    expect(statistics(diary, new Date()).total).toBe(10)
    expect(diary.entries[0].sync).toBe('pending')
  })

  it('dopo acquisizione e timeout riprova lo stesso id senza raddoppiare punti', async () => {
    const key = 'timeout'
    await seed(key)
    await enqueue(key, operation('once'))
    const remote = snapshot()
    let fail = true
    const transport: SyncTransport = {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        if (
          op.type === 'record' &&
          !remote.entries.some((entry) => entry.id === op.entry.id)
        )
          remote.entries.push(op.entry)
        if (fail) throw new Error('Timeout dopo la risposta del server')
      },
    }
    await expect(synchronize(key, transport)).rejects.toThrow(/Timeout/)
    expect((await readAccount(key)).queue).toHaveLength(1)
    fail = false
    await synchronize(key, transport)
    const local = await readAccount(key)
    expect(local.queue).toHaveLength(0)
    expect(local.snapshot?.entries).toHaveLength(1)
    expect(statistics(projectDiary(local)!, new Date()).total).toBe(10)
  })

  it('non rimuove dalla coda un invio acquisito se fallisce la lettura di conferma', async () => {
    const key = 'ack-failed'
    await seed(key)
    await enqueue(key, operation('ack'))
    let calls = 0
    const transport: SyncTransport = {
      snapshot: async () => {
        if (++calls > 1) throw new Error('Rete interrotta')
        return snapshot()
      },
      send: vi.fn(async () => {}),
    }
    await expect(synchronize(key, transport)).rejects.toThrow(/Rete/)
    expect((await readAccount(key)).queue[0].operationId).toBe('ack')
  })

  it('mantiene visibili gli errori di regola senza farli valere come punti', async () => {
    const key = 'rejected'
    await seed(key)
    await enqueue(key, operation('old-rule'))
    await synchronize(key, {
      snapshot: async () => snapshot(),
      send: async () => {
        throw new RemoteError('Regola scaduta', '22023')
      },
    })
    const local = await readAccount(key)
    expect(local.queue[0]).toMatchObject({
      status: 'blocked',
      error: 'Regola scaduta',
    })
    expect(projectDiary(local)?.entries[0].sync).toBe('error')
    expect(statistics(projectDiary(local)!, new Date()).total).toBe(0)
    const send = vi.fn(async () => {})
    await synchronize(key, { snapshot: async () => snapshot(), send })
    expect(send).not.toHaveBeenCalled()
  })

  it('un errore di sessione conserva la coda da riprendere dopo il login', async () => {
    const key = 'reauth'
    await seed(key)
    await enqueue(key, operation('reauth'))
    await expect(
      synchronize(key, {
        snapshot: async () => snapshot(),
        send: async () => {
          throw new RemoteError('Accedi di nuovo', '28000')
        },
      }),
    ).rejects.toThrow(/Accedi/)
    expect((await readAccount(key)).queue[0].status).toBe('pending')
  })

  it('invia un annullamento solo dopo l’episodio originale, senza perderlo alla riapertura', async () => {
    const key = 'void-pending'
    await seed(key)
    await enqueue(key, operation('to-void'))
    await enqueue(key, {
      type: 'void',
      operationId: 'undo',
      status: 'pending',
      entryId: 'to-void',
      at: new Date().toISOString(),
    })
    expect(
      statistics(projectDiary(await readAccount(key))!, new Date()).total,
    ).toBe(0)
    const remote = snapshot()
    const sent: string[] = []
    await synchronize(key, {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        sent.push(op.type)
        if (op.type === 'record') remote.entries.push(op.entry)
        else if (op.type === 'void')
          remote.entries = remote.entries.map((entry) => ({
            ...entry,
            voidedAt: op.at,
          }))
      },
    })
    expect(sent).toEqual(['record', 'void'])
    expect((await readAccount(key)).queue).toHaveLength(0)
    expect((await readAccount(key)).snapshot?.entries[0].voidedAt).toBeTruthy()
  })

  it('una nuova operazione aggiunta durante l’invio non viene sovrascritta', async () => {
    const key = 'concurrent'
    await seed(key)
    await enqueue(key, operation('first'))
    const remote = snapshot()
    await synchronize(key, {
      snapshot: async () => structuredClone(remote),
      send: async (op) => {
        if (op.type === 'record') remote.entries.push(op.entry)
        await enqueue(key, operation('second'))
      },
    })
    expect((await readAccount(key)).queue.map((op) => op.operationId)).toEqual([
      'second',
    ])
    expect(projectDiary(await readAccount(key))?.entries).toHaveLength(2)
  })

  it('non avvia invii successivi dopo che l’account è stato chiuso', async () => {
    const key = 'logout'
    await seed(key)
    await enqueue(key, operation('unsent'))
    const send = vi.fn(async () => {})
    await synchronize(
      key,
      { snapshot: async () => snapshot(), send },
      () => {},
      () => false,
    )
    expect(send).not.toHaveBeenCalled()
    expect((await readAccount(key)).queue).toHaveLength(1)
  })

  it('un annullamento rifiutato conserva i punti confermati', async () => {
    const value = snapshot()
    const op = operation('kept')
    if (op.type !== 'record') throw new Error('setup')
    value.entries.push(op.entry)
    const projected = projectDiary({
      schemaVersion: 1,
      snapshot: value,
      queue: [
        {
          type: 'void',
          operationId: 'bad-undo',
          status: 'blocked',
          entryId: 'kept',
          at: new Date().toISOString(),
          error: 'Rifiutato',
        },
      ],
    })!
    expect(statistics(projected, new Date()).total).toBe(10)
    // The error is shown in the queue; confirmed points are not provisionally removed.
    expect(projected.entries[0]).toMatchObject({ points: 10 })
    expect(projected.entries[0].sync).toBeUndefined()
    expect(projected.entries[0].voidedAt).toBeUndefined()
  })

  it('aggiunte concorrenti e ritentativi locali preservano tutte le operazioni', async () => {
    const key = 'local-concurrency'
    await seed(key)
    const op = operation('a')
    await Promise.all([
      enqueue(key, op),
      enqueue(key, operation('b')),
      enqueue(key, op),
    ])
    expect(
      (await readAccount(key)).queue.map((item) => item.operationId),
    ).toEqual(['a', 'b'])
    if (op.type !== 'record') throw new Error('setup')
    await expect(
      enqueue(key, { ...op, entry: { ...op.entry, points: 100 } }),
    ).rejects.toThrow(/dati diversi/)
    expect((await readAccount(key)).queue).toHaveLength(2)
  })

  it('una futura versione dello storage non viene azzerata o sovrascritta', async () => {
    const key = 'future-schema'
    await updateAccount(key, () => ({ schemaVersion: 2, queue: [] }) as never)
    await expect(readAccount(key)).rejects.toThrow(/conservati/)
    await expect(enqueue(key, operation('do-not-overwrite'))).rejects.toThrow(
      /conservati/,
    )
  })
})
