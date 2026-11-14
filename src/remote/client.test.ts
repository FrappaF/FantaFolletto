import { expect, it, vi } from 'vitest'
import { initialDiary } from '../domain/model'
import { transportFor, type Client } from './client'

it('gli invii usano il token del proprietario per episodi, combo e note senza punti scelti dal client', async () => {
  const setHeader = vi.fn(async () => ({ data: null, error: null }))
  const rpc = vi.fn(() => ({ setHeader }))
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: 'alice' },
            access_token: 'dummy-session-token',
          },
        },
        error: null,
      }),
    },
    rpc,
  } as unknown as Client
  await transportFor(client, 'alice').send({
    type: 'record',
    operationId: 'op',
    status: 'pending',
    entry: {
      id: 'entry',
      eventId: 'event',
      eventVersion: 1,
      name: 'Provvisorio',
      points: 999,
      occurredAt: '2026-11-14T10:00:00Z',
    },
  })
  expect(rpc).toHaveBeenCalledWith('record_episode', {
    client_id: 'entry',
    event_id: 'event',
    event_version: 1,
    occurred_at: '2026-11-14T10:00:00Z',
  })
  expect(setHeader).toHaveBeenCalledWith(
    'Authorization',
    'Bearer dummy-session-token',
  )
  const combo = {
    id: 'combo',
    firstSurname: 'Allegri',
    secondSurname: '',
    note: '',
    createdAt: '2026-11-14T10:00:00Z',
  }
  await transportFor(client, 'alice').send({
    type: 'add-combo',
    operationId: combo.id,
    status: 'pending',
    combo,
  })
  expect(rpc).toHaveBeenLastCalledWith('add_surname_combo', {
    client_id: combo.id,
    first_surname: 'Allegri',
    second_surname: '',
    combo_note: '',
    created_at: combo.createdAt,
  })
  await transportFor(client, 'alice').send({
    type: 'remove-combo',
    operationId: 'remove',
    status: 'pending',
    comboId: combo.id,
    at: combo.createdAt,
  })
  expect(rpc).toHaveBeenLastCalledWith('remove_surname_combo', {
    client_id: combo.id,
  })
  const note = {
    id: 'note',
    day: '2026-11-14',
    text: 'Una giornata',
    createdAt: combo.createdAt,
  }
  await transportFor(client, 'alice').send({
    type: 'add-note',
    operationId: note.id,
    status: 'pending',
    note,
  })
  expect(rpc).toHaveBeenLastCalledWith('add_daily_note', {
    client_id: note.id,
    note_day: note.day,
    note_text: note.text,
    created_at: note.createdAt,
  })
  await transportFor(client, 'alice').send({
    type: 'remove-note',
    operationId: 'remove-note',
    status: 'pending',
    noteId: note.id,
    at: note.createdAt,
  })
  expect(rpc).toHaveBeenLastCalledWith('remove_daily_note', {
    client_id: note.id,
  })
})

it('un cambio account ferma la richiesta prima di accedere al diario precedente', async () => {
  const rpc = vi.fn()
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'bob' }, access_token: 'dummy' } },
      }),
    },
    rpc,
  } as unknown as Client
  await expect(transportFor(client, 'alice').snapshot()).rejects.toMatchObject({
    code: '28000',
  })
  expect(rpc).not.toHaveBeenCalled()
})

it('non accetta una risposta di diario priva delle condizioni previste', async () => {
  const setHeader = vi.fn(async () => ({
    data: {
      ...initialDiary(),
      role: 'player',
      ownerId: 'alice',
      fetchedAt: new Date().toISOString(),
    },
    error: null,
  }))
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'alice' }, access_token: 'dummy' } },
      }),
    },
    rpc: () => ({ setHeader }),
  } as unknown as Client
  await expect(transportFor(client, 'alice').snapshot()).rejects.toThrow(
    /non compatibile/,
  )
})
