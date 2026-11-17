import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { storageFixture } from './storage-fixture'
import { objectPath, parseDoormat, type Doormat } from '../photos/model'
const db = new PGlite()
const player = '10000000-0000-4000-8000-000000000001'
const admin = '10000000-0000-4000-8000-000000000002'
const stranger = '10000000-0000-4000-8000-000000000003'
const photo = (): Doormat => ({
  id: randomUUID(),
  createdBy: player,
  createdAt: '2026-11-17T12:00:00Z',
  day: '2026-11-17',
  caption: 'Benvenuti!',
  width: 1600,
  height: 1200,
  bytes: 250000,
  thumbnailBytes: 25000,
  digest: 'a'.repeat(64),
  thumbnailDigest: 'b'.repeat(64),
  mime: 'image/webp',
  status: 'uploading',
})
async function asUser(
  user: string | null,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec(`begin; set local role ${user ? 'authenticated' : 'anon'};`)
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? '',
    ])
    const result = await db.query(sql, params)
    await db.exec('commit')
    return result.rows as Record<string, any>[]
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}
const prepare = (p: Doormat, user: string | null = player) =>
  asUser(user, 'select public.prepare_doormat($1::jsonb) as status', [p])
const insert = (
  p: Doormat,
  thumb: boolean,
  user: string | null = player,
  overrides = {},
) =>
  asUser(
    user,
    "insert into storage.objects(bucket_id,name,metadata) values('doormats',$1,$2)",
    [
      objectPath(p, thumb),
      {
        size: thumb ? p.thumbnailBytes : p.bytes,
        mimetype: p.mime,
        ...overrides,
      },
    ],
  )
const finalize = (p: Doormat, user = player) =>
  asUser(user, 'select public.finalize_doormat($1)', [p.id])
const remove = (p: Doormat, user = admin) =>
  asUser(user, 'select public.remove_doormat($1)', [p.id])
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin null; end $$; grant usage on schema auth to anon,authenticated; insert into auth.users values('${player}'),('${admin}'),('${stranger}');`,
  )
  await storageFixture(db)
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(new URL(file, dir), 'utf8'))
  await db.query(
    "insert into public.profiles values($1,'player'),($2,'admin')",
    [player, admin],
  )
}, 30000)
beforeEach(() => db.exec('truncate storage.objects,public.doormats;'))
afterAll(() => db.close())
it('crea un bucket privato con limiti e non concede accesso anonimo o estraneo', async () => {
  expect(
    (
      await db.query(
        "select public,file_size_limit,allowed_mime_types from storage.buckets where id='doormats'",
      )
    ).rows,
  ).toEqual([
    {
      public: false,
      file_size_limit: 1000000,
      allowed_mime_types: ['image/jpeg', 'image/webp'],
    },
  ])
  await expect(prepare(photo(), null)).rejects.toThrow(/permission denied/)
  await expect(prepare(photo(), stranger)).rejects.toThrow(/autorizzato/)
  await prepare(photo())
  for (const user of [null, stranger])
    expect(await asUser(user, 'select * from storage.objects')).toEqual([])
  expect(
    (await asUser(stranger, 'select public.list_doormats() as items'))[0].items,
  ).toEqual([])
  await expect(asUser(player, 'delete from public.doormats')).rejects.toThrow(
    /permission denied/,
  )
})
it('valida peso, formato, data, autore e payload idempotente', async () => {
  const p = photo()
  for (const changes of [
    { bytes: 1000001 },
    { mime: 'image/png' },
    { width: 1601 },
    { width: 1.5 },
    { thumbnailBytes: 100001 },
    { day: '2026-02-30' },
    { createdBy: admin },
    { digest: 'no' },
  ])
    await expect(prepare({ ...p, ...changes } as Doormat)).rejects.toThrow()
  expect((await prepare(p))[0].status).toBe('uploading')
  await prepare(p)
  await expect(prepare({ ...p, caption: 'diversa' })).rejects.toThrow(
    /dati diversi/,
  )
  await expect(prepare({ ...p, createdBy: admin }, admin)).rejects.toThrow(
    /dati diversi/,
  )
  expect(
    (
      await asUser(player, 'select public.list_doormats() as items')
    )[0].items.map(parseDoormat),
  ).toHaveLength(1)
})
it('limita upload ai due percorsi prenotati e finalizza solo con entrambi i file corretti', async () => {
  const p = photo()
  await expect(insert(p, false)).rejects.toThrow(/row-level/)
  await prepare(p)
  await expect(insert(p, false, admin)).rejects.toThrow(/row-level/)
  await expect(insert(p, false, stranger)).rejects.toThrow(/row-level/)
  await expect(insert({ ...p, digest: 'c'.repeat(64) }, false)).rejects.toThrow(
    /row-level/,
  )
  await insert(p, false)
  await expect(finalize(p)).rejects.toThrow(/miniatura/)
  await insert(p, true, player, { size: 24 })
  await expect(finalize(p)).rejects.toThrow(/miniatura/)
  await db.query(
    "update storage.objects set metadata=jsonb_set(metadata,'{size}','25000') where name=$1",
    [objectPath(p, true)],
  )
  await expect(finalize(p, admin)).rejects.toThrow(/autorizzata/)
  await finalize(p)
  await finalize(p)
  expect(
    (await asUser(admin, 'select public.list_doormats() as items'))[0].items[0]
      .status,
  ).toBe('ready')
  expect(
    await asUser(
      admin,
      "select name from storage.objects where bucket_id='doormats'",
    ),
  ).toHaveLength(2)
  expect(
    await asUser(
      player,
      "update storage.objects set metadata='{}' returning id",
    ),
  ).toEqual([])
  expect(
    await asUser(admin, 'delete from storage.objects returning id'),
  ).toEqual([])
})
it('rimuove da entrambi i ruoli, permette la pulizia e non resuscita su un invio tardivo', async () => {
  const p = photo()
  await prepare(p)
  await insert(p, false)
  await insert(p, true)
  await finalize(p)
  await remove(p)
  await remove(p, player)
  expect((await prepare(p))[0].status).toBe('removed')
  await finalize(p)
  await asUser(admin, 'delete from storage.objects')
  await expect(insert(p, false)).rejects.toThrow(/row-level/)
  expect(
    (await db.query('select status,removed_by from public.doormats')).rows,
  ).toEqual([{ status: 'removed', removed_by: admin }])
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
})
