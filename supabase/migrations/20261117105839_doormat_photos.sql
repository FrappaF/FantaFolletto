-- Raccolta privata di immagini ottimizzate. I file si gestiscono solo con le API
-- Storage; la rimozione dei metadati non sostituisce la cancellazione degli oggetti.
begin;

create table public.doormats (
  id uuid primary key,
  created_by uuid not null references public.profiles(id),
  details jsonb not null,
  status text not null default 'uploading' check (status in ('uploading','ready','removed')),
  received_at timestamptz not null default clock_timestamp(),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id),
  photo_path text generated always as (created_by::text || '/' || id::text || '/photo-' || (details->>'digest')) stored,
  thumbnail_path text generated always as (created_by::text || '/' || id::text || '/thumb-' || (details->>'thumbnailDigest')) stored
);
create index doormats_created_by_idx on public.doormats(created_by);
create index doormats_removed_by_idx on public.doormats(removed_by);
alter table public.doormats enable row level security;
create policy doormats_read on public.doormats for select to authenticated
using ((select private.role()) in ('player','admin') and (status <> 'uploading' or created_by = (select auth.uid())));
revoke all on public.doormats from public, anon, authenticated;
grant select on public.doormats to authenticated;

-- Business writes remain in private, explicitly authorized functions. Public
-- invoker wrappers expose only these operations, never unrestricted table writes.
create function private.prepare_doormat(photo jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  previous public.doormats;
  photo_id uuid := (photo->>'id')::uuid;
  details_value jsonb := photo - 'status';
  field_name text;
  limit_value integer;
begin
  if auth.uid() is null or coalesce(private.role(),'') not in ('player','admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  if photo_id is null or (photo->>'createdBy')::uuid is distinct from auth.uid()
    or jsonb_typeof(photo->'caption') is distinct from 'string' or length(photo->>'caption') > 300
    or coalesce(photo->>'mime','') not in ('image/jpeg','image/webp')
    or coalesce(photo->>'digest','') !~ '^[0-9a-f]{64}$'
    or coalesce(photo->>'thumbnailDigest','') !~ '^[0-9a-f]{64}$'
    or coalesce(photo->>'day','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (photo->>'day')::date not between date '0001-01-01' and date '9999-12-31'
    or (photo->>'createdAt')::timestamptz is null or not isfinite((photo->>'createdAt')::timestamptz) then
    raise exception 'Controlla i dati della foto.' using errcode = '22023';
  end if;
  foreach field_name in array array['width','height','bytes','thumbnailBytes'] loop
    limit_value := case field_name when 'bytes' then 1000000 when 'thumbnailBytes' then 100000 else 1600 end;
    if jsonb_typeof(photo->field_name) is distinct from 'number'
      or (photo->>field_name)::numeric not between 1 and limit_value
      or trunc((photo->>field_name)::numeric) <> (photo->>field_name)::numeric then
      raise exception 'Dimensioni della foto non valide.' using errcode = '22023';
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('doormat:' || photo_id::text, 0));
  select * into previous from public.doormats where id = photo_id;
  if found then
    if previous.created_by <> auth.uid() or previous.details <> details_value then
      raise exception 'Identificativo foto già usato con dati diversi.' using errcode = '22023';
    end if;
    return previous.status;
  end if;
  insert into public.doormats(id,created_by,details) values(photo_id,auth.uid(),details_value);
  return 'uploading';
end $$;

create function private.finalize_doormat(client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.doormats;
begin
  if auth.uid() is null or coalesce(private.role(),'') not in ('player','admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('doormat:' || client_id::text, 0));
  select * into p from public.doormats where id = client_id;
  if not found or p.created_by <> auth.uid() then
    raise exception 'Foto non trovata o non autorizzata.' using errcode = '42501';
  end if;
  if p.status in ('ready','removed') then return; end if;
  if not exists(select 1 from storage.objects where bucket_id='doormats' and name=p.photo_path
      and (metadata->>'size')::bigint = (p.details->>'bytes')::bigint and metadata->>'mimetype' = p.details->>'mime')
    or not exists(select 1 from storage.objects where bucket_id='doormats' and name=p.thumbnail_path
      and (metadata->>'size')::bigint = (p.details->>'thumbnailBytes')::bigint and metadata->>'mimetype' = p.details->>'mime') then
    raise exception 'Carica foto e miniatura prima di confermare.' using errcode = '22023';
  end if;
  update public.doormats set status='ready' where id=client_id;
end $$;

create function private.remove_doormat(client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(private.role(),'') not in ('player','admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('doormat:' || client_id::text, 0));
  update public.doormats set status='removed', removed_at=coalesce(removed_at,clock_timestamp()),
    removed_by=coalesce(removed_by,auth.uid()) where id=client_id
    and (status <> 'uploading' or created_by=auth.uid());
  if not found then raise exception 'Foto non trovata.' using errcode = '42501'; end if;
end $$;

create function public.prepare_doormat(photo jsonb) returns text
language sql security invoker set search_path = '' as $$ select private.prepare_doormat(photo) $$;
create function public.finalize_doormat(client_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.finalize_doormat(client_id) $$;
create function public.remove_doormat(client_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.remove_doormat(client_id) $$;
create function public.list_doormats() returns jsonb
language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(details || jsonb_build_object('status',status) order by received_at,id),'[]'::jsonb) from public.doormats
$$;
revoke all on function private.prepare_doormat(jsonb), private.finalize_doormat(uuid), private.remove_doormat(uuid),
  public.prepare_doormat(jsonb), public.finalize_doormat(uuid), public.remove_doormat(uuid), public.list_doormats() from public,anon,authenticated;
grant execute on function private.prepare_doormat(jsonb), private.finalize_doormat(uuid), private.remove_doormat(uuid),
  public.prepare_doormat(jsonb), public.finalize_doormat(uuid), public.remove_doormat(uuid), public.list_doormats() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('doormats','doormats',false,1000000,array['image/jpeg','image/webp']);

-- No UPDATE policy: uploads are immutable, including retries. Author-only
-- INSERT is limited to the two exact paths of a reservation still in progress.
create policy doormat_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id='doormats' and (select private.role()) in ('player','admin') and exists(
    select 1 from public.doormats p where p.created_by=(select auth.uid()) and p.status='uploading'
      and name in (p.photo_path,p.thumbnail_path)
  )
);
create policy doormat_objects_read on storage.objects for select to authenticated using (
  bucket_id='doormats' and (select private.role()) in ('player','admin') and exists(
    select 1 from public.doormats p where name in (p.photo_path,p.thumbnail_path)
  )
);
create policy doormat_objects_delete on storage.objects for delete to authenticated using (
  bucket_id='doormats' and (select private.role()) in ('player','admin') and exists(
    select 1 from public.doormats p where p.status='removed' and name in (p.photo_path,p.thumbnail_path)
  )
);
commit;
