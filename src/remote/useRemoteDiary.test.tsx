// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { initialDiary } from '../domain/model'
import { accountKey, readAccount, updateAccount } from './account-store'
import { useRemoteDiary } from './useRemoteDiary'
import type { Client } from './client'

vi.mock('./client', () => ({
  transportFor: () => ({
    snapshot: async () => {
      throw new Error('Offline')
    },
    send: async () => {
      throw new Error('Offline')
    },
    manage: async () => {
      throw new Error('Non deve gestire il catalogo')
    },
  }),
}))
afterEach(cleanup)

it.each(['player', 'admin'] as const)(
  'conserva combo e note con le rimozioni offline anche per %s',
  async (role) => {
    const url = 'https://combos.supabase.co'
    const key = accountKey(url, role)
    await updateAccount(key, () => ({
      schemaVersion: 1,
      queue: [],
      snapshot: {
        ...initialDiary(),
        role,
        ownerId: 'player',
        fetchedAt: new Date().toISOString(),
      },
    }))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, unmount } = renderHook(
      () => useRemoteDiary({} as Client, url, role),
      { wrapper },
    )
    await waitFor(() => expect(result.current.diary).toBeTruthy())
    const combo = {
      id: `combo-${role}`,
      firstSurname: 'Belli',
      secondSurname: '',
      note: '',
      createdAt: new Date().toISOString(),
    }
    await act(async () => {
      expect(
        await result.current.execute({ type: 'add-combo', value: combo }),
      ).toBe(true)
    })
    expect(result.current.diary?.combos?.[0]).toMatchObject({
      ...combo,
      sync: 'pending',
    })
    expect((await readAccount(key)).queue).toHaveLength(1)
    await act(async () => {
      expect(
        await result.current.execute({
          type: 'remove-combo',
          id: combo.id,
          at: combo.createdAt,
        }),
      ).toBe(true)
    })
    expect(result.current.diary?.combos?.[0].removedAt).toBe(combo.createdAt)
    const note = {
      id: `note-${role}`,
      day: '2026-11-14',
      text: 'Una giornata da ricordare',
      createdAt: combo.createdAt,
    }
    await act(async () => {
      expect(
        await result.current.execute({ type: 'add-note', value: note }),
      ).toBe(true)
    })
    expect(result.current.diary?.notes?.[0]).toMatchObject({
      ...note,
      sync: 'pending',
    })
    await act(async () => {
      expect(
        await result.current.execute({
          type: 'remove-note',
          id: note.id,
          at: note.createdAt,
        }),
      ).toBe(true)
    })
    expect(result.current.diary?.notes?.[0].removedAt).toBe(note.createdAt)
    unmount()
    expect((await readAccount(key)).queue.map((op) => op.type)).toEqual([
      'add-combo',
      'remove-combo',
      'add-note',
      'remove-note',
    ])
    queryClient.clear()
  },
)

it.each(['player', 'admin'] as const)(
  'salva il riscatto senza anticipare l’addebito, solo per player (%s)',
  async (role) => {
    const { weekKey } = await import('../domain/stats')
    const url = 'https://rewards.supabase.co'
    const key = accountKey(url, role)
    const at = new Date().toISOString()
    await updateAccount(key, () => ({
      schemaVersion: 1,
      queue: [],
      snapshot: {
        ...initialDiary(),
        role,
        ownerId: 'player',
        fetchedAt: at,
        entries: [
          {
            id: 'episode',
            eventId: 'coffee',
            eventVersion: 1,
            name: 'Evento',
            points: 200,
            occurredAt: at,
          },
        ],
        pointBalance: { current: 200, maximum: 200 },
      },
    }))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, unmount } = renderHook(
      () => useRemoteDiary({} as Client, url, role),
      { wrapper },
    )
    await waitFor(() => expect(result.current.diary).toBeTruthy())
    const command = {
      type: 'redeem-reward',
      id: 'redemption',
      rewardId: 'breakfast',
      expectedVersion: 1,
      periodKey: weekKey(at),
      at,
    } as const
    await act(async () => {
      expect(await result.current.execute(command)).toBe(role === 'player')
    })
    expect(result.current.diary?.pointBalance).toEqual({
      current: 200,
      maximum: 200,
    })
    if (role === 'player') {
      expect((await readAccount(key)).queue).toMatchObject([
        {
          type: 'redeem-reward',
          operationId: 'redemption',
          status: 'pending',
        },
      ])
      await act(async () => {
        expect(await result.current.execute({ ...command, id: 'second' })).toBe(
          false,
        )
      })
      expect(result.current.error).toMatch(/Attendi/)
    } else {
      expect((await readAccount(key)).queue).toHaveLength(0)
      expect(result.current.error).toMatch(/giocatrice/)
    }
    unmount()
    queryClient.clear()
  },
)
