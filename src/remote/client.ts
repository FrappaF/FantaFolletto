import { createClient } from '@supabase/supabase-js'
import type { AdminCommand } from '../domain/model'
import { newId } from '../domain/ids'
import { RemoteError, type QueuedOperation, type RemoteSnapshot } from './types'
import { parseDiary } from '../domain/validation'

import type { RemoteConfig } from './config'
export type { RemoteConfig } from './config'

export const makeClient = (config: RemoteConfig) =>
  createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(15000),
        }),
    },
  })
export type Client = ReturnType<typeof makeClient>

export function transportFor(client: Client, userId: string) {
  async function checkOwner() {
    const { data, error } = await client.auth.getSession()
    if (error || data.session?.user.id !== userId)
      throw new RemoteError(
        'Accedi di nuovo con lo stesso account per riprendere gli invii.',
        '28000',
      )
    return data.session.access_token
  }
  return {
    async snapshot(): Promise<RemoteSnapshot> {
      const token = await checkOwner()
      const { data, error } = await client
        .rpc('diary_snapshot')
        .setHeader('Authorization', `Bearer ${token}`)
      if (error) throw new RemoteError(error.message, error.code)
      if (
        data?.schemaVersion !== 1 ||
        !['player', 'admin'].includes(data?.role) ||
        !Array.isArray(data?.entries) ||
        !Array.isArray(data?.events) ||
        !Array.isArray(data?.rewards) ||
        !Array.isArray(data?.awards) ||
        typeof data?.ownerId !== 'string' ||
        !Number.isFinite(Date.parse(data?.fetchedAt))
      )
        throw new RemoteError(
          'Il server ha restituito un diario non compatibile.',
          '22023',
        )
      parseDiary(data)
      return data as RemoteSnapshot
    },
    async send(operation: QueuedOperation) {
      const token = await checkOwner()
      const { error } =
        operation.type === 'record'
          ? await client
              .rpc('record_episode', {
                client_id: operation.entry.id,
                event_id: operation.entry.eventId,
                event_version: operation.entry.eventVersion,
                occurred_at: operation.entry.occurredAt,
              })
              .setHeader('Authorization', `Bearer ${token}`)
          : await client
              .rpc('void_episode', { client_id: operation.entryId })
              .setHeader('Authorization', `Bearer ${token}`)
      if (error) throw new RemoteError(error.message, error.code)
    },
    async manage(command: AdminCommand) {
      const token = await checkOwner()
      const { operationId, ...payload } = command
      const { error } = await client
        .rpc('manage_diary', {
          operation_id: operationId ?? newId(),
          command: payload,
        })
        .setHeader('Authorization', `Bearer ${token}`)
      if (error) throw new RemoteError(error.message, error.code)
    },
  }
}
