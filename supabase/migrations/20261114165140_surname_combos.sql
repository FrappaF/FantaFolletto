-- Raccolta condivisa tra i due ruoli, indipendente da episodi, punti e premi.
begin;

create table public.surname_combos (
  id uuid primary key,
  first_surname text not null check (length(btrim(first_surname)) between 1 and 60),
  second_surname text not null default '' check (length(second_surname) <= 60),
  note text not null default '' check (length(note) <= 180),
  created_at timestamptz not null check (isfinite(created_at)),
  received_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.profiles(id),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id)
);
create index surname_combos_created_by_idx on public.surname_combos(created_by);
create index surname_combos_removed_by_idx on public.surname_combos(removed_by);

alter table public.surname_combos enable row level security;
create policy combos_read on public.surname_combos for select to authenticated
  using ((select private.role()) in ('player', 'admin'));
revoke all on public.surname_combos from public, anon, authenticated;
grant select on public.surname_combos to authenticated;

-- Le scritture passano dalle RPC: ruolo verificato nel DB, payload immutabili,
-- stesso lock per creazione/rimozione e ritentativi idempotenti dopo timeout.
create function public.add_surname_combo(
  client_id uuid, first_surname text, second_surname text default '',
  combo_note text default '', created_at timestamptz default clock_timestamp()
) returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.surname_combos;
  first_value text := btrim(first_surname);
  second_value text := btrim(coalesce(second_surname, ''));
  note_value text := btrim(coalesce(combo_note, ''));
begin
  if auth.uid() is null or coalesce(private.role(), '') not in ('player', 'admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  if client_id is null or first_value is null or length(first_value) not between 1 and 60
    or length(second_value) > 60 or length(note_value) > 180
    or created_at is null or not isfinite(created_at) then
    raise exception 'Controlla i cognomi, la nota e la data.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(client_id::text, 0));
  select * into previous from public.surname_combos where id = client_id;
  if found then
    if previous.created_by <> auth.uid() or previous.first_surname <> first_value
      or previous.second_surname <> second_value or previous.note <> note_value
      or previous.created_at <> add_surname_combo.created_at then
      raise exception 'Identificativo già usato con dati diversi.' using errcode = '22023';
    end if;
    return;
  end if;
  insert into public.surname_combos(id, first_surname, second_surname, note, created_at, created_by)
    values (client_id, first_value, second_value, note_value, add_surname_combo.created_at, auth.uid());
end $$;

create function public.remove_surname_combo(client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(private.role(), '') not in ('player', 'admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(client_id::text, 0));
  update public.surname_combos
    set removed_at = coalesce(removed_at, clock_timestamp()),
        removed_by = coalesce(removed_by, auth.uid())
    where id = client_id;
  if not found then raise exception 'Combo non trovata.' using errcode = '22023'; end if;
end $$;

revoke all on function public.add_surname_combo(uuid, text, text, text, timestamptz),
  public.remove_surname_combo(uuid) from public, anon, authenticated;
grant execute on function public.add_surname_combo(uuid, text, text, text, timestamptz),
  public.remove_surname_combo(uuid) to authenticated;

create or replace function public.diary_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller_role text := private.role(); owner uuid; result jsonb;
begin
  if caller_role is null then raise exception 'Accesso non autorizzato.' using errcode = '42501'; end if;
  select id into owner from public.profiles where role = 'player';
  if owner is null then raise exception 'La giocatrice non è ancora configurata.'; end if;
  if caller_role = 'player' and owner <> auth.uid() then raise exception 'Accesso non autorizzato.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'role', caller_role, 'ownerId', owner, 'fetchedAt', clock_timestamp(), 'schemaVersion', 1,
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', v.name, 'description', v.description, 'points', v.points, 'version', e.version, 'archived', e.archived) order by v.valid_from, e.id) from public.events e join public.event_versions v on v.event_id = e.id and v.version = e.version), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'description', description, 'target', target, 'period', period, 'version', version, 'archived', archived) order by target, id) from public.rewards), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'eventId', event_id, 'eventVersion', event_version, 'name', name, 'points', points, 'occurredAt', occurred_at, 'receivedAt', received_at, 'voidedAt', voided_at)) order by occurred_at, id) from public.entries where owner_id = owner), '[]'::jsonb),
    'combos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'firstSurname', first_surname, 'secondSurname', second_surname, 'note', note, 'createdAt', created_at, 'removedAt', removed_at)) order by created_at, id) from public.surname_combos), '[]'::jsonb),
    'awards', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'rewardId', reward_id, 'name', name, 'description', description, 'target', target, 'period', period, 'periodKey', period_key, 'achievedAt', achieved_at, 'revokedAt', revoked_at, 'deliveredAt', delivered_at, 'needsReview', needs_review)) order by achieved_at desc) from public.awards where owner_id = owner), '[]'::jsonb)
  ) into result;
  return result;
end $$;


commit;
