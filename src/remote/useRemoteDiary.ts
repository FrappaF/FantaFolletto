import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AdminCommand, Command } from '../domain/model'
import { newId } from '../domain/ids'
import {
  accountKey,
  enqueue,
  readAccount,
  updateAccount,
} from './account-store'
import { transportFor, type Client } from './client'
import { projectDiary, type AccountCache } from './types'
import { synchronize } from './sync'
import { statistics } from '../domain/stats'

export function useRemoteDiary(
  client: Client,
  projectUrl: string,
  userId: string,
) {
  const key = accountKey(projectUrl, userId)
  const transport = useMemo(
    () => transportFor(client, userId),
    [client, userId],
  )
  const [cache, setCache] = useState<AccountCache>({
    schemaVersion: 1,
    queue: [],
  })
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = useRef(true)
  const saving = useRef(false)
  const channel = useRef<BroadcastChannel | null>(null)

  async function load() {
    const next = await readAccount(key)
    if (active.current) setCache(next)
    return next
  }
  const query = useQuery({
    queryKey: ['diary-sync', key],
    queryFn: async () => {
      try {
        await synchronize(
          key,
          transport,
          () => {
            channel.current?.postMessage('changed')
            void load().catch(() => {})
          },
          () => active.current,
        )
        await load()
        if (active.current) setSyncError('')
        return Date.now()
      } catch (failure) {
        if (active.current)
          setSyncError(
            failure instanceof Error
              ? failure.message
              : 'Il diario condiviso non è raggiungibile. Riproverò tra poco.',
          )
        throw failure
      }
    },
    retry: false,
    networkMode: 'always',
    refetchInterval: 30000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    gcTime: 0,
  })

  useEffect(() => {
    active.current = true
    void load().catch((failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : 'Impossibile leggere i dati sul telefono.',
      ),
    )
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel(`fantafolletto:${key}`)
      channel.current.onmessage = () => {
        void load().catch(() => {})
      }
    }
    const refresh = () => {
      if (document.visibilityState === 'visible') void query.refetch()
    }
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active.current = false
      channel.current?.close()
      channel.current = null
      document.removeEventListener('visibilitychange', refresh)
    }
    // The component is keyed by project and user and cannot change owner in place.
  }, [key])

  async function execute(command: Command | AdminCommand) {
    if (saving.current) return false
    saving.current = true
    setBusy(true)
    setError('')
    try {
      const current = await readAccount(key)
      if (!current.snapshot)
        throw new Error(
          'Apri il diario online almeno una volta prima di segnare episodi.',
        )
      if (command.type === 'record' || command.type === 'void') {
        if (current.snapshot.role !== 'player')
          throw new Error('Solo la giocatrice può segnare o annullare episodi.')
        let saved: AccountCache
        if (command.type === 'record') {
          const event = current.snapshot.events.find(
            (item) => item.id === command.eventId && !item.archived,
          )
          if (!event)
            throw new Error('Evento non più disponibile. Aggiorna il catalogo.')
          saved = await enqueue(key, {
            type: 'record',
            operationId: command.id,
            status: 'pending',
            entry: {
              id: command.id,
              eventId: event.id,
              eventVersion: command.version ?? event.version,
              name: command.snapshot?.name ?? event.name,
              points: command.snapshot?.points ?? event.points,
              occurredAt: command.at,
            },
          })
        } else {
          saved = await enqueue(key, {
            type: 'void',
            operationId: newId(),
            status: 'pending',
            entryId: command.id,
            at: command.at,
          })
        }
        if (active.current) setCache(saved)
        channel.current?.postMessage('changed')
        void query.refetch()
      } else {
        if (current.snapshot.role !== 'admin')
          throw new Error('Operazione riservata all’admin.')
        const id = 'value' in command ? command.value.id : command.id
        const expectedVersion =
          command.expectedVersion ??
          (command.type.includes('event')
            ? current.snapshot.events.find((item) => item.id === id)?.version
            : current.snapshot.rewards.find((item) => item.id === id)
                ?.version) ??
          0
        await transport.manage({ ...command, expectedVersion })
        channel.current?.postMessage('changed')
        // A successful write must not be reported as failed just because the refresh fails.
        try {
          const snapshot = await transport.snapshot()
          await updateAccount(key, (value) => ({ ...value, snapshot }))
          await load()
        } catch {
          setSyncError(
            'Modifica salvata. Ricarica il diario per vedere i dati aggiornati.',
          )
          void query.refetch()
        }
      }
      return true
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Operazione non riuscita. Riprova.',
      )
      return false
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  async function retryBlocked() {
    try {
      await updateAccount(key, (value) => ({
        ...value,
        queue: value.queue.map((item) => ({
          ...item,
          status: 'pending',
          error: undefined,
        })),
      }))
      await load()
      void query.refetch()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Ritentativo non riuscito.',
      )
    }
  }

  // Discard is intentionally restricted to rejected records. Ambiguous deliveries remain queued.
  async function discardRejected(operationId: string) {
    try {
      await updateAccount(key, (value) => {
        const rejected = value.queue.find(
          (item) => item.operationId === operationId,
        )
        if (!rejected || rejected.status !== 'blocked') return value
        return {
          ...value,
          queue: value.queue.filter(
            (item) =>
              item.operationId !== operationId &&
              !(
                rejected.type === 'record' &&
                item.type === 'void' &&
                item.entryId === rejected.entry.id
              ),
          ),
        }
      })
      await load()
      channel.current?.postMessage('changed')
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Impossibile aggiornare la coda.',
      )
    }
  }

  return {
    diary: projectDiary(cache),
    busy,
    error,
    execute,
    refresh: async () => {
      setError('')
      await query.refetch()
    },
    remote: {
      role: cache.snapshot?.role,
      queue: cache.queue,
      syncError,
      syncing: query.isFetching,
      fetchedAt: cache.snapshot?.fetchedAt,
      confirmedTotal: cache.snapshot
        ? statistics(cache.snapshot, new Date()).total
        : 0,
      retryBlocked,
      discardRejected,
    },
  }
}
