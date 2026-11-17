import type { PGlite } from '@electric-sql/pglite'

// PostgreSQL contract of Storage, without an S3 service. File transfer and
// bucket size/MIME enforcement still need a real Storage integration check.
export async function storageFixture(db: PGlite) {
  await db.exec(`
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
  `)
}
