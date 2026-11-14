import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest'
import { parseDiary } from '../domain/validation'
import { randomUUID } from 'node:crypto'
const db = new PGlite()
const player = '10000000-0000-4000-8000-000000000001'
const admin = '10000000-0000-4000-8000-000000000002'
const event = '20000000-0000-4000-8000-000000000001'
const daily = '20000000-0000-4000-8000-000000000002'
async function asUser(
  user: string | null,
  query: string,
  params: unknown[] = [],
) {
  await db.exec(`begin; set local role ${user ? 'authenticated' : 'anon'};`)
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? '',
    ])
    const result = await db.query(query, params)
    await db.exec('commit')
    return result.rows as Record<string, any>[]
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}
async function manage(command: object, id = randomUUID()) {
  return asUser(admin, 'select public.manage_diary($1,$2::jsonb)', [
    id,
    JSON.stringify(command),
  ])
}
async function record(id: string = randomUUID(), eventId = event, at?: string) {
  await asUser(
    player,
    'select public.record_episode($1,$2,1,coalesce($3::timestamptz,clock_timestamp()))',
    [id, eventId, at ?? null],
  )
  return id
}
async function entries() {
  return (
    await db.query(
      'select id,points,base_points,combo_index,bonus_points,scoring_version from public.entries where voided_at is null order by occurred_at,id',
    )
  ).rows as Record<string, any>[]
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='' as $$ begin null; end $$; grant usage on schema auth to anon,authenticated; insert into auth.users values('${player}'),('${admin}');`,
  )
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(new URL(file, dir), 'utf8'))
  await db.query(
    "insert into public.profiles values($1,'player'),($2,'admin')",
    [player, admin],
  )
  for (const [id, repeat] of [
    [event, 'unlimited'],
    [daily, 'daily'],
  ])
    await manage({
      type: 'save-event',
      expectedVersion: 0,
      value: {
        id,
        name: 'Evento test',
        description: '',
        points: 10,
        categoryId: 'wins',
        rarity: 'rare',
        repeat,
      },
    })
  await db.exec(
    "update public.event_versions set valid_from=clock_timestamp()-interval '8 days';",
  )
}, 30000)
beforeEach(async () => {
  await db.exec(
    'truncate public.entries,public.awards,public.admin_audit; delete from public.scoring_rules where version > 2; update public.scoring_rules set increment_percent=20,max_multiplier=3 where version=2;',
  )
})
afterAll(() => db.close())
it('serve il catalogo scelto, le categorie e lo snapshot validabile dal client', async () => {
  const snapshot = (
    await asUser(player, 'select public.diary_snapshot() as snapshot')
  )[0].snapshot
  expect(snapshot.categories).toHaveLength(6)
  expect(
    snapshot.events.filter(
      (item: { name: string }) => item.name !== 'Evento test',
    ),
  ).toHaveLength(37)
  expect(
    snapshot.events.some(
      (item: { name: string }) => item.name === 'Il civico fantasma',
    ),
  ).toBe(false)
  expect(parseDiary(snapshot).scoringRules).toHaveLength(2)
})
it('assegna 10/12/14, deduplica e ricalcola annullamenti e premi', async () => {
  const first = await record()
  await record()
  await record()
  expect((await entries()).map((entry) => entry.points)).toEqual([10, 12, 14])
  const last = (
    await db.query<{ id: string; occurred_at: string }>(
      'select id,occurred_at::text from public.entries order by received_at desc limit 1',
    )
  ).rows[0]
  await record(last.id, event, last.occurred_at)
  expect(await entries()).toHaveLength(3)
  await manage({
    type: 'save-reward',
    expectedVersion: 0,
    value: {
      id: randomUUID(),
      name: 'Traguardo test',
      description: '',
      target: 30,
      period: 'all',
    },
  })
  await asUser(player, 'select public.void_episode($1)', [first])
  expect((await entries()).map((entry) => entry.points)).toEqual([10, 12])
  expect(
    (
      await db.query(
        'select revoked_at is not null as revoked from public.awards',
      )
    ).rows,
  ).toEqual([{ revoked: true }])
})
it('inserimenti offline fuori ordine usano la sequenza cronologica e mantengono le regole del giorno', async () => {
  const times = (
    await db.query<{ early: string; later: string }>(
      "select (clock_timestamp()-interval '2 minutes')::text as early, (clock_timestamp()-interval '1 minute')::text as later",
    )
  ).rows[0]
  await record(randomUUID(), event, times.later)
  await record(randomUUID(), event, times.early)
  expect((await entries()).map((entry) => entry.points)).toEqual([10, 12])
  const command = {
    type: 'save-scoring',
    expectedVersion: 2,
    value: { incrementPercent: 100, maxMultiplier: 4.5 },
  }
  const op = randomUUID()
  await manage(command, op)
  await manage(command, op)
  expect(
    (
      await db.query(
        'select count(*)::integer as count from public.scoring_rules',
      )
    ).rows,
  ).toEqual([{ count: 3 }])
  await record()
  expect((await entries()).map((entry) => entry.points)).toEqual([10, 12, 14])
  expect(
    (
      await db.query(
        "select effective_day=((clock_timestamp() at time zone 'Europe/Rome')::date+1) as tomorrow from public.scoring_rules where version=3",
      )
    ).rows,
  ).toEqual([{ tomorrow: true }])
  await expect(manage(command)).rejects.toThrow(/cambiate/)
})
it('rispetta il tetto decimale, esclude i malus e separa i giorni italiani', async () => {
  await db.exec(
    'update public.scoring_rules set max_multiplier=1.5 where version=2;',
  )
  for (let index = 0; index < 5; index++) await record()
  expect((await entries()).map((entry) => entry.points)).toEqual([
    10, 12, 14, 15, 15,
  ])
  const yesterday = (
    await db.query<{ at: string }>(
      "select (((clock_timestamp() at time zone 'Europe/Rome')::date-1)+time '23:59') at time zone 'Europe/Rome' as at",
    )
  ).rows[0].at
  await record(randomUUID(), event, yesterday)
  expect((await entries())[0].points).toBe(10)
  const negative = randomUUID()
  await manage({
    type: 'save-event',
    expectedVersion: 0,
    value: {
      id: negative,
      name: 'Malus',
      description: '',
      points: -10,
      categoryId: 'mishaps',
      repeat: 'unlimited',
    },
  })
  await record(randomUUID(), negative)
  await record(randomUUID(), negative)
  expect(
    (await entries())
      .filter((entry) => entry.base_points < 0)
      .map((entry) => entry.points),
  ).toEqual([-10, -10])
})
it('blocca le sfide ripetute anche con nuovi identificativi, ma permette di correggere un annullamento', async () => {
  const first = await record(randomUUID(), daily)
  await expect(record(randomUUID(), daily)).rejects.toThrow(/già stata/)
  await asUser(player, 'select public.void_episode($1)', [first])
  await record(randomUUID(), daily)
  expect((await entries())[0]).toMatchObject({
    points: 10,
    bonus_points: 0,
    scoring_version: null,
  })
})
it('protegge impostazioni, funzioni private, categorie e limiti numerici', async () => {
  for (const query of [
    'update public.scoring_rules set increment_percent=900',
    'delete from public.event_categories',
    'select private.legacy_diary_snapshot()',
    "select private.legacy_manage_diary(gen_random_uuid(),'{}')",
    'select private.recalculate_combo(auth.uid(),gen_random_uuid(),current_date)',
  ])
    await expect(asUser(player, query)).rejects.toThrow(/permission denied/)
  await expect(asUser(null, 'select public.diary_snapshot()')).rejects.toThrow(
    /permission denied/,
  )
  await expect(
    asUser(player, 'select public.manage_diary($1,$2)', [
      randomUUID(),
      {
        type: 'save-scoring',
        expectedVersion: 2,
        value: { incrementPercent: 20, maxMultiplier: 3 },
      },
    ]),
  ).rejects.toThrow(/admin/)
  for (const value of [
    { incrementPercent: 20, maxMultiplier: 21 },
    { incrementPercent: 20, maxMultiplier: 1.23 },
    { incrementPercent: 2.5, maxMultiplier: 3 },
    { incrementPercent: -1, maxMultiplier: 3 },
  ])
    await expect(
      manage({ type: 'save-scoring', expectedVersion: 2, value }),
    ).rejects.toThrow()
  await asUser(admin, 'select public.manage_diary($1,$2)', [
    randomUUID(),
    {
      type: 'save-scoring',
      expectedVersion: 2,
      value: { incrementPercent: 0, maxMultiplier: 1 },
    },
  ])
})
