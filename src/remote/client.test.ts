import { expect, it, vi } from 'vitest'
import { initialDiary } from '../domain/model'
import { transportFor, type Client } from './client'

it('gli invii usano il token del proprietario verificato e non mandano punti scelti dal client', async () => {
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
