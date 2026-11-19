import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { storageFixture } from './storage-fixture'
import { parseDiary } from '../domain/validation'
import { pledgeOccurrences } from '../domain/pledges'
import type { Diary } from '../domain/model'

const db = new PGlite()
const player = '10000000-0000-4000-8000-000000000001'
const admin = '10000000-0000-4000-8000-000000000002'
const stranger = '10000000-0000-4000-8000-000000000003'
const pledgeId = '50000000-0000-4000-8000-000000000001'
const eventId = '20000000-0000-4000-8000-000000000001'
const rewardId = '30000000-0000-4000-8000-000000000001'
let lastWeek: string
let thisWeek: string
let lastMonth: string
let now: Date

async function asUser<T = Record<string, unknown>>(user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`begin; set local role ${user ? 'authenticated' : 'anon'};`)
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ''])
    const result = await db.query<T>(sql, args)
    await db.exec('commit')
    return result.rows
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}
const manage = (command: object, operation = randomUUID(), user: string | null = admin) =>
  asUser(user, 'select public.manage_diary($1,$2)', [operation, command])
const save = (period = 'week', target = 100, version = 0, name = 'Una cena offerta') => ({
  type: 'save-pledge', expectedVersion: version,
  value: { id: pledgeId, name, description: 'Tocca a te!', target, period },
})
const collect = (key = lastWeek, id = randomUUID(), version = 1) => ({
  type: 'redeem-pledge', id, pledgeId, periodKey: key,
  at: new Date().toISOString(), expectedVersion: version,
})
async function snapshot(user = player) {
  const result = (await asUser<{ diary: Diary }>(user, 'select public.diary_snapshot() as diary'))[0].diary
  parseDiary(result)
  return result
}
async function activate(period = 'week', day = lastWeek) {
  await manage(save(period))
  // Fa avanzare una definizione di prova nel passato senza alterare l'orologio del DB.
  await db.query('update public.pledge_versions set effective_from=$1 where id=$2', [day, pledgeId])
}
async function episode(points: number, day: string, voided = false) {
  const id = randomUUID()
  await db.query(`insert into public.entries(owner_id,id,event_id,event_version,name,points,occurred_at,voided_at)
    values($1,$2,$3,1,'Evento',$4,($5::date + time '12:00') at time zone 'Europe/Rome',
    case when $6 then clock_timestamp() else null end)`, [player, id, eventId, points, day, voided])
  return id
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='' as $$ begin null; end $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values('${player}'),('${admin}'),('${stranger}');
  `)
  await storageFixture(db)
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((file) => file.endsWith('.sql')).sort())
    await db.exec(readFileSync(new URL(file, dir), 'utf8'))
  await db.query("insert into public.profiles values($1,'player'),($2,'admin')", [player, admin])
  const dates = (await db.query<{ week: string; previous: string; month: string; now: string }>(`select
    private.week_key(clock_timestamp()) as week,
    to_char(private.pledge_period_start('week',(clock_timestamp() at time zone 'Europe/Rome')::date)-7,'YYYY-MM-DD') as previous,
    to_char(private.pledge_period_start('month',(clock_timestamp() at time zone 'Europe/Rome')::date)-interval '1 month','YYYY-MM-DD') as month,
    clock_timestamp()::text as now`)).rows[0]
  thisWeek = dates.week
  lastWeek = dates.previous
  lastMonth = dates.month
  now = new Date(dates.now)
}, 30000)
afterAll(() => db.close())
beforeEach(async () => {
  await db.exec('truncate public.pledge_claims,public.pledge_versions,public.entries,public.awards,public.rewards,public.admin_audit,public.point_balances;')
  await db.exec('delete from public.event_versions; delete from public.events;')
  await manage({ type: 'save-event', expectedVersion: 0, value: { id: eventId, name: 'Evento', description: '', points: 50 } })
})

it('limita gestione e riscossioni all’admin, lettura ai due ruoli e vieta scritture dirette', async () => {
  for (const user of [null, player, stranger]) {
    for (const command of [save(), { type: 'archive-pledge', id: pledgeId, expectedVersion: 1 }, collect()])
      await expect(manage(command, randomUUID(), user)).rejects.toThrow(/permission denied|riservata/)
  }
  await activate()
  for (const user of [player, admin]) {
    expect((await snapshot(user)).pledges).toHaveLength(1)
    for (const sql of [
      'update public.pledge_versions set target=1',
      'delete from public.pledge_versions',
      'insert into public.pledge_versions select * from public.pledge_versions',
      'update public.pledge_claims set points=9999',
      'delete from public.pledge_claims',
      'insert into public.pledge_claims select * from public.pledge_claims',
      'select private.pledge_points(null,\'week\',current_date)',
      'select private.diary_snapshot_before_pledges()',
      'select private.manage_diary_before_pledges(null,null)',
    ]) await expect(asUser(user, sql)).rejects.toThrow(/permission denied/)
  }
  expect(await asUser(stranger, 'select * from public.pledge_versions')).toEqual([])
  expect(await asUser(stranger, 'select * from public.pledge_claims')).toEqual([])
})

it('salva versioni future, deduplica le operazioni e non modifica le condizioni passate', async () => {
  const operation = randomUUID()
  const command = save()
  await manage(command, operation)
  await manage(command, operation)
  await expect(manage(save('week', 200), operation)).rejects.toThrow(/dati diversi/)
  const first = (await snapshot()).pledges![0]
  expect(first.effectiveFrom).toBe((await db.query<{ day: string }>("select to_char(private.pledge_next_start('week',(clock_timestamp() at time zone 'Europe/Rome')::date),'YYYY-MM-DD') as day")).rows[0].day)
  await expect(manage(save('week', 200, 0))).rejects.toThrow(/cambiato/)
  await expect(manage(save('month', 200, 1))).rejects.toThrow(/periodo/)
  await db.query('update public.pledge_versions set effective_from=$1 where id=$2', [lastWeek, pledgeId])
  await manage(save('week', 200, 1, 'Un altro nome'))
  const diary = await snapshot()
  expect(diary.pledges).toHaveLength(2)
  expect(diary.pledges![0]).toMatchObject({ name: 'Una cena offerta', target: 100, effectiveFrom: lastWeek, version: 1 })
  expect(pledgeOccurrences(diary, now).find((item) => item.periodKey === lastWeek)?.pledge.version).toBe(1)
  await manage({ type: 'archive-pledge', id: pledgeId, expectedVersion: 2 })
  await manage(collect())
  const archived = await snapshot()
  expect(archived.pledges).toHaveLength(3)
  expect(archived.pledgeClaims![0]).toMatchObject({ name: 'Una cena offerta', target: 100, pledgeVersion: 1 })
  await expect(manage(save('week', 400, 3))).rejects.toThrow(/archiviato/)
})

it('riscuote una sola volta i periodi conclusi senza toccare saldo, premi o punti', async () => {
  await activate()
  await episode(60, lastWeek)
  await episode(500, lastWeek, true)
  await episode(500, thisWeek)
  await expect(manage(collect(thisWeek))).rejects.toThrow(/concluso/)
  await expect(manage(collect('2000-01-03'))).rejects.toThrow(/disponibile/)
  const invalidKey = (await db.query<{ day: string }>("select to_char($1::date+1,'YYYY-MM-DD') as day", [lastWeek])).rows[0].day
  await expect(manage(collect(invalidKey))).rejects.toThrow(/valido/)
  await expect(manage(collect(lastWeek, randomUUID(), 2))).rejects.toThrow(/cambiato/)
  const before = await snapshot()
  const id = randomUUID()
  const command = collect(lastWeek, id)
  const operation = randomUUID()
  await manage(command, operation)
  await manage(command, operation)
  await manage(command)
  await expect(manage(collect())).rejects.toThrow(/già riscosso/)
  await expect(manage(collect(thisWeek, id))).rejects.toThrow(/dati diversi/)
  const after = await snapshot()
  expect(after.pledgeClaims).toHaveLength(1)
  expect(after.pledgeClaims![0]).toMatchObject({ points: 60, target: 100, periodKey: lastWeek, needsReview: false })
  expect(after.entries).toEqual(before.entries)
  expect(after.awards).toEqual(before.awards)
  expect(after.pointBalance).toEqual(before.pointBalance)
})

it('conta punti guadagnati, ignora la spesa per premi e aggiorna il riesame dopo correzioni', async () => {
  await activate()
  const id = await episode(100, lastWeek)
  await manage({ type: 'save-reward', expectedVersion: 0, value: { id: rewardId, name: 'Premio', description: '', target: 100, period: 'all' } })
  await asUser(player, 'select public.redeem_reward($1,$2,1,\'all\')', [randomUUID(), rewardId])
  expect((await snapshot()).pointBalance?.current).toBe(0)
  await expect(manage(collect())).rejects.toThrow(/quota.*raggiunta/)
  await asUser(player, 'select public.void_episode($1)', [id])
  const command = collect()
  await manage(command)
  await episode(100, lastWeek)
  const after = await snapshot()
  expect(after.pledgeClaims![0]).toMatchObject({ points: 0, needsReview: true })
  expect(pledgeOccurrences(after, now).find((item) => item.periodKey === lastWeek)).toMatchObject({ status: 'collected', needsReview: true })
  // Il ritentativo resta sicuro anche se nel frattempo la quota è stata raggiunta.
  await manage(command)
  expect((await snapshot()).pledgeClaims).toHaveLength(1)
})

it('valida i campi e conserva l’ultima versione se più modifiche partono dallo stesso giorno', async () => {
  for (const command of [save('all'), save('week', 0), save('week', 100001), save('week', 1.5), save('week', 100, 0, '\t\n'), save('week', 100, 0, 'a'.repeat(61))])
    await expect(manage(command)).rejects.toThrow()
  await expect(manage({ ...save(), expectedVersion: null })).rejects.toThrow(/Versione/)
  await manage(save('month'))
  await manage(save('month', 200, 1))
  const diary = await snapshot()
  expect(pledgeOccurrences(diary, now)).toHaveLength(1)
  expect(pledgeOccurrences(diary, now)[0].pledge).toMatchObject({ version: 2, target: 200 })
})

it('riscuote pegni mensili e usa confini italiani anche nei cambi d’ora e anno', async () => {
  await activate('month', lastMonth)
  await episode(99, lastMonth)
  await manage(collect(lastMonth))
  expect((await snapshot()).pledgeClaims![0]).toMatchObject({ period: 'month', periodKey: lastMonth, points: 99 })
  const boundaries = (await db.query<{ spring: string; autumn: string; leap: string; year: string }>(`select
    (private.pledge_next_start('week','2026-03-23')::timestamp at time zone 'Europe/Rome')::text as spring,
    (private.pledge_next_start('week','2026-10-19')::timestamp at time zone 'Europe/Rome')::text as autumn,
    private.pledge_next_start('month','2028-02-01')::text as leap,
    private.pledge_next_start('month','2026-12-31')::text as year`)).rows[0]
  expect(new Date(boundaries.spring).toISOString()).toBe('2026-03-29T22:00:00.000Z')
  expect(new Date(boundaries.autumn).toISOString()).toBe('2026-10-25T23:00:00.000Z')
  expect(boundaries.leap).toBe('2028-03-01')
  expect(boundaries.year).toBe('2027-01-01')
})


it('riconosce un episodio inviato in ritardo dopo la chiusura e mantiene la riscossione da verificare', async () => {
  await activate()
  await episode(50, lastWeek)
  await db.query("update public.event_versions set valid_from=($1::date::timestamp at time zone 'Europe/Rome') where event_id=$2", [lastWeek, eventId])
  const command = collect()
  await manage(command)
  const lateTime = (await db.query<{ at: string }>("select (($1::date::timestamp at time zone 'Europe/Rome')-interval '1 second')::text as at", [thisWeek])).rows[0].at
  const clientId = randomUUID()
  await asUser(player, 'select public.record_episode($1,$2,1,$3::timestamptz)', [clientId, eventId, lateTime])
  await asUser(player, 'select public.record_episode($1,$2,1,$3::timestamptz)', [clientId, eventId, lateTime])
  const diary = await snapshot()
  expect(diary.pledgeClaims![0]).toMatchObject({ points: 50, needsReview: true })
  expect(pledgeOccurrences(diary, now).find((item) => item.periodKey === lastWeek)).toMatchObject({ points: 100, status: 'collected', needsReview: true })
  await manage(command)
  expect((await snapshot()).pledgeClaims).toHaveLength(1)
})
