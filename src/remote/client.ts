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
      const request = (() => {
        switch (operation.type) {
          case 'redeem-reward':
            return client.rpc('redeem_reward', {
              client_id: operation.operationId,
              reward_id: operation.rewardId,
              expected_version: operation.expectedVersion,
              period_key: operation.periodKey,
            })
          case 'record':
            return client.rpc('record_episode', {
              client_id: operation.entry.id,
              event_id: operation.entry.eventId,
              event_version: operation.entry.eventVersion,
              occurred_at: operation.entry.occurredAt,
            })
          case 'void':
            return client.rpc('void_episode', {
              client_id: operation.entryId,
            })
          case 'add-combo':
            return client.rpc('add_surname_combo', {
              client_id: operation.combo.id,
              first_surname: operation.combo.firstSurname,
              second_surname: operation.combo.secondSurname,
              combo_note: operation.combo.note,
              created_at: operation.combo.createdAt,
            })
          case 'remove-combo':
            return client.rpc('remove_surname_combo', {
              client_id: operation.comboId,
            })
          case 'add-note':
            return client.rpc('add_daily_note', {
              client_id: operation.note.id,
              note_day: operation.note.day,
              note_text: operation.note.text,
              created_at: operation.note.createdAt,
            })
          case 'remove-note':
            return client.rpc('remove_daily_note', {
              client_id: operation.noteId,
            })
        }
      })()
      const { error } = await request.setHeader(
        'Authorization',
        `Bearer ${token}`,
      )
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
