// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { initialDiary, type Command } from '../domain/model'
import { accountKey, updateAccount } from './account-store'
import { useRemoteDiary } from './useRemoteDiary'
import type { Client } from './client'

const manage = vi.hoisted(() => vi.fn(async (_command: unknown) => {}))
vi.mock('./client', () => ({
  transportFor: () => ({
    snapshot: async () => { throw new Error('Offline') },
    send: async () => { throw new Error('Offline') },
    manage,
  }),
}))
afterEach(() => { cleanup(); manage.mockClear() })

async function setup(role: 'player' | 'admin', pending = false) {
  const url = 'https://pledges.supabase.co'
  const userId = `${role}-${pending}`
  const at = new Date().toISOString()
  const entry = { id: 'episode', eventId: 'coffee', eventVersion: 1, name: 'Caffè', points: 10, basePoints: 10, occurredAt: at }
  await updateAccount(accountKey(url, userId), () => ({
    schemaVersion: 1,
    queue: pending ? [{ type: 'record', operationId: 'queued', status: 'pending', entry: { ...entry, id: 'queued' } }] : [],
    snapshot: {
      ...initialDiary(), role, ownerId: 'player', fetchedAt: at,
      entries: [entry],
      pledges: [
        { id: 'pledge', version: 1, name: 'Una colazione', description: '', target: 100, period: 'week', effectiveFrom: '2026-11-02', archived: false },
        { id: 'pledge', version: 2, name: 'Una cena', description: '', target: 200, period: 'week', effectiveFrom: '2026-11-23', archived: false },
      ],
      pledgeClaims: [],
    },
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = renderHook(() => useRemoteDiary({} as Client, url, userId), { wrapper })
  await waitFor(() => expect(hook.result.current.diary).toBeTruthy())
  return { ...hook, close: () => { hook.unmount(); client.clear() } }
}

it('riserva la riscossione all’admin e mantiene la versione storica del periodo', async () => {
  const command: Command = { type: 'redeem-pledge', id: 'claim', pledgeId: 'pledge', periodKey: '2026-11-02', at: new Date().toISOString(), expectedVersion: 1, operationId: 'operation' }
  const player = await setup('player')
  await act(async () => { expect(await player.result.current.execute(command)).toBe(false) })
  expect(manage).not.toHaveBeenCalled()
  expect(player.result.current.error).toMatch(/admin/)
  player.close()
  const admin = await setup('admin')
  await act(async () => { expect(await admin.result.current.execute(command)).toBe(true) })
  expect(manage).toHaveBeenCalledWith(command)
  expect(admin.result.current.error).toBe('')
  expect(admin.result.current.diary?.pledgeClaims).toEqual([])
  admin.close()
})

it('mantiene uno snapshot confermato indipendente dalla proiezione delle combo e blocca riscossioni con coda pendente', async () => {
  const admin = await setup('admin', true)
  expect(admin.result.current.diary?.entries).toHaveLength(2)
  expect(admin.result.current.confirmedDiary?.entries).toHaveLength(1)
  expect(admin.result.current.confirmedDiary?.entries[0].points).toBe(10)
  await act(async () => {
    expect(await admin.result.current.execute({ type: 'redeem-pledge', id: 'claim', pledgeId: 'pledge', periodKey: '2026-11-02', at: new Date().toISOString(), expectedVersion: 1 })).toBe(false)
  })
  expect(manage).not.toHaveBeenCalled()
  expect(admin.result.current.error).toMatch(/Attendi/)
  admin.close()
})

it('usa l’ultima versione dei pegni per le modifiche senza cercarla tra i premi', async () => {
  const admin = await setup('admin')
  await act(async () => {
    expect(await admin.result.current.execute({ type: 'archive-pledge', id: 'pledge', operationId: 'archive' })).toBe(true)
  })
  expect(manage).toHaveBeenCalledWith({ type: 'archive-pledge', id: 'pledge', operationId: 'archive', expectedVersion: 2 })
  admin.close()
})
