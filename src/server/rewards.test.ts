import { PGlite } from '@electric-sql/pglite'
import { storageFixture } from './storage-fixture'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { parseDiary } from '../domain/validation'
const db = new PGlite()
const player = '10000000-0000-4000-8000-000000000001'
const admin = '10000000-0000-4000-8000-000000000002'
const stranger = '10000000-0000-4000-8000-000000000003'
const event = '20000000-0000-4000-8000-000000000001'
const reward = '30000000-0000-4000-8000-000000000001'
const otherReward = '30000000-0000-4000-8000-000000000002'
const dir = new URL('../../supabase/migrations/', import.meta.url)
const migrations = readdirSync(dir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
async function prepare(target: PGlite, legacy = false) {
  await target.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='' as $$ begin null; end $$;
    grant usage on schema auth to anon,authenticated;
    insert into auth.users values('${player}'),('${admin}'),('${stranger}');
  `)
  await storageFixture(target)
  for (const file of migrations.filter(
    (file) => !legacy || !file.includes('manual_reward_redemptions'),
  ))
    await target.exec(readFileSync(new URL(file, dir), 'utf8'))
  await target.query(
    "insert into public.profiles values($1,'player'),($2,'admin')",
    [player, admin],
  )
}
async function asUser(user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`begin; set local role ${user ? 'authenticated' : 'anon'};`)
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? '',
    ])
    const result = await db.query(sql, args)
    await db.exec('commit')
    return result.rows as Record<string, any>[]
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}
async function manage(command: object) {
  return asUser(admin, 'select public.manage_diary($1,$2)', [
    randomUUID(),
    command,
  ])
}
async function record() {
  const id = randomUUID()
  await asUser(
    player,
    'select public.record_episode($1,$2,1,clock_timestamp())',
    [id, event],
  )
  return id
}
const redeem = (
  id = randomUUID(),
  target = reward,
  version = 1,
  key = 'all',
  user: string | null = player,
) =>
  asUser(user, 'select public.redeem_reward($1,$2,$3,$4)', [
    id,
    target,
    version,
    key,
  ])
const balance = async () =>
  (await asUser(player, 'select public.diary_snapshot() as diary'))[0].diary
    .pointBalance
beforeAll(() => prepare(db), 30000)
afterAll(() => db.close())
beforeEach(async () => {
  await db.exec(
    'truncate public.entries,public.awards,public.rewards,public.admin_audit,public.point_balances;',
  )
  await db.exec(
    'delete from public.event_versions; delete from public.events; update public.scoring_rules set increment_percent=0,max_multiplier=1;',
  )
  await manage({
    type: 'save-event',
    expectedVersion: 0,
    value: { id: event, name: 'Evento', description: '', points: 50 },
  })
  for (const id of [reward, otherReward])
    await manage({
      type: 'save-reward',
      expectedVersion: 0,
      value: {
        id,
        name: 'Premio',
        description: '',
        target: 40,
        period: 'all',
      },
    })
})
it('nega accesso anonimo, admin, estranei e scritture dirette sui saldi', async () => {
  for (const user of [null, admin, stranger])
    await expect(redeem(randomUUID(), reward, 1, 'all', user)).rejects.toThrow(
      /permission denied|giocatrice/,
    )
  for (const user of [player, admin]) {
    await expect(
      asUser(user, 'update public.point_balances set current_points=9999'),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(
        user,
        'insert into public.point_balances values(auth.uid(),9999,9999)',
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(user, 'select private.refresh_point_balance($1)', [player]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(user, 'select private.diary_snapshot_before_redemptions()'),
    ).rejects.toThrow(/permission denied/)
  }
  expect(await asUser(stranger, 'select * from public.point_balances')).toEqual(
    [],
  )
})
it('blocca doppia spesa e versioni obsolete; i ritentativi restano validi dopo modifica e archiviazione', async () => {
  await expect(redeem()).rejects.toThrow(/insufficienti/)
  await record()
  expect((await db.query('select * from public.awards')).rows).toHaveLength(0)
  await expect(redeem(randomUUID(), reward, 2)).rejects.toThrow(/cambiato/)
  const id = randomUUID()
  await redeem(id)
  expect(await balance()).toEqual({ current: 10, maximum: 50 })
  await expect(redeem(randomUUID(), otherReward)).rejects.toThrow(
    /insufficienti/,
  )
  await expect(redeem(id, otherReward)).rejects.toThrow(/dati diversi/)
  await manage({
    type: 'save-reward',
    expectedVersion: 1,
    value: {
      id: reward,
      name: 'Premio nuovo',
      description: '',
      target: 100,
      period: 'week',
    },
  })
  await manage({ type: 'archive-reward', id: reward, expectedVersion: 2 })
  await redeem(id)
  expect(await balance()).toEqual({ current: 10, maximum: 50 })
  const snapshot = (
    await asUser(admin, 'select public.diary_snapshot() as diary')
  )[0].diary
  expect(parseDiary(snapshot).awards?.[0]).toMatchObject({
    name: 'Premio',
    target: 40,
    pointsSpent: 40,
    rewardVersion: 1,
  })
  await expect(redeem(randomUUID(), reward, 2)).rejects.toThrow(/disponibile/)
})
it('mantiene massimo e riscatto dopo correzioni; i nuovi punti recuperano il saldo', async () => {
  const entry = await record()
  await redeem()
  await asUser(player, 'select public.void_episode($1)', [entry])
  expect(await balance()).toEqual({ current: -40, maximum: 50 })
  await expect(redeem(randomUUID(), otherReward)).rejects.toThrow(
    /insufficienti/,
  )
  await record()
  expect(await balance()).toEqual({ current: 10, maximum: 50 })
  expect(
    (
      await asUser(player, 'select needs_review,revoked_at from public.awards')
    )[0],
  ).toEqual({ needs_review: false, revoked_at: null })
})
it('usa la settimana italiana, nega periodi scaduti e consente una sola scelta per settimana', async () => {
  await manage({
    type: 'save-reward',
    expectedVersion: 1,
    value: {
      id: reward,
      name: 'Settimana',
      description: '',
      target: 40,
      period: 'week',
    },
  })
  const key = (
    await db.query<{ key: string }>(
      'select private.week_key(clock_timestamp()) as key',
    )
  ).rows[0].key
  await record()
  await expect(redeem(randomUUID(), reward, 2, '2000-01-03')).rejects.toThrow(
    /periodo/,
  )
  const id = randomUUID()
  await redeem(id, reward, 2, key)
  await record()
  await expect(redeem(randomUUID(), reward, 2, key)).rejects.toThrow(
    /già riscattato/,
  )
  // Rappresenta il passaggio alla settimana successiva senza alterare l'orologio PostgreSQL.
  await db.query(
    "update public.awards set period_key='2000-01-03' where id=$1",
    [id],
  )
  await db.exec(
    "update public.entries set occurred_at=clock_timestamp()-interval '8 days'",
  )
  await expect(redeem(randomUUID(), reward, 2, key)).rejects.toThrow(
    /insufficienti/,
  )
  await record()
  await redeem(randomUUID(), reward, 2, key)
  expect((await db.query('select * from public.awards')).rows).toHaveLength(2)
})
it('migra i premi automatici senza cancellarli o addebitarli retroattivamente', async () => {
  const legacy = new PGlite()
  try {
    await prepare(legacy, true)
    await legacy.query(
      "insert into public.rewards(id,name,description,target,period) values($1,'Premio storico','',40,'all')",
      [reward],
    )
    await legacy.query('insert into public.events(id,version) values($1,1)', [
      event,
    ])
    await legacy.query(
      "insert into public.event_versions(event_id,version,name,description,points) values($1,1,'Evento','',50)",
      [event],
    )
    await legacy.query(
      "insert into public.entries(owner_id,id,event_id,event_version,name,points,occurred_at) values($1,$2,$3,1,'Evento',50,clock_timestamp())",
      [player, randomUUID(), event],
    )
    await legacy.query('select private.reconcile_awards($1)', [player])
    const before = (
      await legacy.query<Record<string, unknown>>('select * from public.awards')
    ).rows
    const file = migrations.find((file) =>
      file.includes('manual_reward_redemptions'),
    )!
    await legacy.exec(readFileSync(new URL(file, dir), 'utf8'))
    expect(
      (
        await legacy.query(
          'select current_points,maximum_points from public.point_balances',
        )
      ).rows,
    ).toEqual([{ current_points: 50, maximum_points: 50 }])
    const after = (
      await legacy.query<Record<string, unknown>>('select * from public.awards')
    ).rows
    expect(after).toEqual(
      before.map((award) => ({
        ...award,
        redeemed_at: null,
        points_spent: null,
      })),
    )
    await legacy.query("select set_config('request.jwt.claim.sub',$1,false)", [
      admin,
    ])
    await expect(
      legacy.query('select public.manage_diary($1,$2)', [
        randomUUID(),
        { type: 'deliver-award', id: (after[0] as { id: string }).id },
      ]),
    ).rejects.toThrow(/prima riscattare/)
    await legacy.query("select set_config('request.jwt.claim.sub',$1,false)", [
      player,
    ])
    await legacy.query("select public.redeem_reward($1,$2,1,'all')", [
      randomUUID(),
      reward,
    ])
    expect(
      (
        await legacy.query(
          'select current_points,maximum_points from public.point_balances',
        )
      ).rows,
    ).toEqual([{ current_points: 10, maximum_points: 50 }])
    expect(
      (
        await legacy.query<Record<string, unknown>>(
          'select * from public.awards',
        )
      ).rows,
    ).toHaveLength(2)
  } finally {
    await legacy.close()
  }
}, 30000)
