import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const player = '10000000-0000-4000-8000-000000000001'
const admin = '10000000-0000-4000-8000-000000000002'
const stranger = '10000000-0000-4000-8000-000000000003'
const eventId = '20000000-0000-4000-8000-000000000001'
const rewardId = '30000000-0000-4000-8000-000000000001'
let operation = 0
const opId = () =>
  `40000000-0000-4000-8000-${String(++operation).padStart(12, '0')}`

async function asUser<T>(
  user: string | null,
  query: string,
  params: unknown[] = [],
) {
  await db.exec(`begin; set local role ${user ? 'authenticated' : 'anon'};`)
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
      user ?? '',
    ])
    const result = await db.query<T>(query, params)
    await db.exec('commit')
    return result.rows
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}
async function manage(command: object, id = opId()) {
  await asUser(admin, 'select public.manage_diary($1, $2::jsonb)', [
    id,
    JSON.stringify(command),
  ])
}
async function record(id: string, version = 1, at?: string) {
  await asUser(
    player,
    'select public.record_episode($1, $2, $3, coalesce($4::timestamptz, clock_timestamp()))',
    [id, eventId, version, at ?? null],
  )
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path = '' as $$ begin null; end $$;
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values ('${player}'), ('${admin}'), ('${stranger}');
  `)
  const migrations = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(new URL(file, migrations), 'utf8'))
  }
  await db.query('insert into public.profiles values ($1, $2), ($3, $4)', [
    player,
    'player',
    admin,
    'admin',
  ])
}, 30000)
afterAll(async () => {
  await db.close()
})

describe('PostgreSQL: autorizzazione e transazioni reali (auth simulata)', () => {
  it('il trigger automatico RLS non è eseguibile dai client e le operazioni admin sono uniche', async () => {
    expect(
      (
        await db.query(
          "select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon_execute, has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated_execute",
        )
      ).rows,
    ).toEqual([{ anon_execute: false, authenticated_execute: false }])
    expect(
      (
        await db.query(
          "select indexdef from pg_indexes where indexname = 'admin_audit_command_operation_idx'",
        )
      ).rows,
    ).toHaveLength(1)
  })
  it('nega anonimi, utenti senza profilo e auto-promozione del ruolo', async () => {
    await expect(
      asUser(null, 'select public.diary_snapshot()'),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(stranger, 'select public.diary_snapshot()'),
    ).rejects.toThrow(/non autorizzato/)
    await expect(
      asUser(
        player,
        "update public.profiles set role = 'admin' where id = auth.uid()",
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(player, 'select private.reconcile_awards(auth.uid())'),
    ).rejects.toThrow(/permission denied/)
    expect(await asUser(player, 'select role from public.profiles')).toEqual([
      { role: 'player' },
    ])
    expect(
      (await asUser(admin, 'select role from public.profiles')).length,
    ).toBe(2)
  })

  it('solo admin gestisce il catalogo, con deduplicazione e controllo versione', async () => {
    const command = {
      type: 'save-event',
      expectedVersion: 0,
      value: { id: eventId, name: 'Un caffè', description: '', points: 10 },
    }
    await expect(
      asUser(player, 'select public.manage_diary($1, $2)', [opId(), command]),
    ).rejects.toThrow(/admin/)
    const id = opId()
    await manage(command, id)
    await manage(command, id)
    expect((await db.query('select version from public.events')).rows).toEqual([
      { version: 1 },
    ])
    await expect(
      manage({ ...command, value: { ...command.value, points: 90 } }, id),
    ).rejects.toThrow(/dati diversi/)
    await expect(manage(command)).rejects.toThrow(/cambiato/)
    await expect(
      asUser(
        player,
        "insert into public.entries(owner_id,id,event_id,event_version,name,points,occurred_at) values (auth.uid(),gen_random_uuid(),$1,1,'falso',9999,now())",
        [eventId],
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('assegna punti dal server, respinge payload incompatibili e protegge lo storico', async () => {
    const id = opId()
    const at = (
      await db.query<{ at: string }>('select clock_timestamp()::text as at')
    ).rows[0].at
    await record(id, 1, at)
    await record(id, 1, at)
    await expect(record(id, 1, '2020-01-01T12:00:00Z')).rejects.toThrow(
      /dati diversi/,
    )
    await manage({
      type: 'save-event',
      expectedVersion: 1,
      value: {
        id: eventId,
        name: 'Caffè speciale',
        description: '',
        points: 40,
      },
    })
    await record(opId(), 2)
    expect(
      (
        await db.query(
          'select name, points from public.entries order by received_at',
        )
      ).rows,
    ).toEqual([
      { name: 'Un caffè', points: 10 },
      { name: 'Caffè speciale', points: 40 },
    ])
    await expect(
      asUser(admin, 'select public.record_episode($1,$2,2,clock_timestamp())', [
        opId(),
        eventId,
      ]),
    ).rejects.toThrow(/giocatrice/)
    const snapshots = await asUser<{
      diary_snapshot: { role: string; entries: unknown[] }
    }>(admin, 'select public.diary_snapshot()')
    expect(snapshots[0].diary_snapshot.role).toBe('admin')
    expect(snapshots[0].diary_snapshot.entries).toHaveLength(2)
  })

  it('sblocca premi unici, revoca quelli non consegnati e conserva le condizioni storiche', async () => {
    await manage({
      type: 'save-reward',
      expectedVersion: 0,
      value: {
        id: rewardId,
        name: 'Cena',
        description: 'Insieme',
        target: 50,
        period: 'all',
      },
    })
    const award = (
      await db.query<{ id: string; target: number }>(
        'select id,target from public.awards',
      )
    ).rows[0]
    expect(award.target).toBe(50)
    const last = (
      await db.query<{ id: string }>(
        'select id from public.entries order by received_at desc limit 1',
      )
    ).rows[0].id
    await asUser(player, 'select public.void_episode($1)', [last])
    await asUser(player, 'select public.void_episode($1)', [last])
    expect(
      (
        await db.query(
          'select revoked_at is not null as revoked from public.awards',
        )
      ).rows,
    ).toEqual([{ revoked: true }])
    await manage({
      type: 'save-reward',
      expectedVersion: 1,
      value: {
        id: rewardId,
        name: 'Cena nuova',
        description: '',
        target: 60,
        period: 'all',
      },
    })
    await record(opId(), 2)
    expect(
      (await db.query('select name,target,revoked_at from public.awards')).rows,
    ).toEqual([{ name: 'Cena', target: 50, revoked_at: null }])
    await record(opId(), 2)
    await manage({ type: 'deliver-award', id: award.id })
    const entries = (
      await db.query<{ id: string }>(
        'select id from public.entries where voided_at is null',
      )
    ).rows
    for (const entry of entries)
      await asUser(player, 'select public.void_episode($1)', [entry.id])
    expect(
      (
        await db.query(
          'select needs_review, delivered_at is not null as delivered, revoked_at from public.awards',
        )
      ).rows,
    ).toEqual([{ needs_review: true, delivered: true, revoked_at: null }])
  })

  it('accetta una vecchia regola solo nel periodo in cui era valida, entro sette giorni', async () => {
    const at = (
      await db.query<{ at: string }>(
        'select valid_from::text as at from public.event_versions where version = 1',
      )
    ).rows[0].at
    await record(opId(), 1, at)
    await expect(record(opId(), 1)).rejects.toThrow(/non era valida/)
    await expect(record(opId(), 2, '2020-01-01T12:00:00Z')).rejects.toThrow(
      /7 giorni/,
    )
    await manage({ type: 'archive-event', id: eventId, expectedVersion: 2 })
    await expect(record(opId(), 2)).rejects.toThrow(/non era valida/)
  })

  it('un nuovo premio settimanale non crea assegnazioni retroattive e conserva la soglia storica', async () => {
    const weeklyId = '30000000-0000-4000-8000-000000000002'
    // Seed a historical episode as the owner to represent an already-used database.
    await db.query(
      "insert into public.entries(owner_id,id,event_id,event_version,name,points,occurred_at) values ($1,$2,$3,1,'Settimana precedente',100,(date_trunc('week',clock_timestamp() at time zone 'Europe/Rome') - interval '1 day') at time zone 'Europe/Rome')",
      [player, opId(), eventId],
    )
    await manage({
      type: 'save-reward',
      expectedVersion: 0,
      value: {
        id: weeklyId,
        name: 'Colazione',
        description: '',
        target: 5,
        period: 'week',
      },
    })
    const awards = (
      await db.query<{ period_key: string; target: number }>(
        'select period_key,target from public.awards where reward_id = $1',
        [weeklyId],
      )
    ).rows
    expect(awards).toHaveLength(1)
    expect(awards[0].target).toBe(5)
    const currentKey = (
      await db.query<{ key: string }>(
        'select private.week_key(clock_timestamp()) as key',
      )
    ).rows[0].key
    expect(awards[0].period_key).toBe(currentKey)
    await manage({
      type: 'save-reward',
      expectedVersion: 1,
      value: {
        id: weeklyId,
        name: 'Colazione nuova',
        description: '',
        target: 500,
        period: 'week',
      },
    })
    expect(
      (
        await db.query(
          'select name,target from public.awards where reward_id = $1',
          [weeklyId],
        )
      ).rows,
    ).toEqual([{ name: 'Colazione', target: 5 }])
    expect(await asUser(stranger, 'select id from public.entries')).toEqual([])
    expect(await asUser(stranger, 'select id from public.awards')).toEqual([])
  })
})
