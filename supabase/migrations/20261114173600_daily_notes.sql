-- Appunti condivisi per giornata, senza effetti su episodi, punti o premi.
begin;

create table public.daily_notes (
  id uuid primary key,
  day date not null check (day between date '0001-01-01' and date '9999-12-31'),
  text text not null check (length(text) between 1 and 2000 and text !~ '^[[:space:]]*$'),
  created_at timestamptz not null check (isfinite(created_at)),
  received_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references public.profiles(id),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id)
);
create index daily_notes_created_by_idx on public.daily_notes(created_by);
create index daily_notes_removed_by_idx on public.daily_notes(removed_by);

alter table public.daily_notes enable row level security;
create policy daily_notes_read on public.daily_notes for select to authenticated
  using ((select private.role()) in ('player', 'admin'));
revoke all on public.daily_notes from public, anon, authenticated;
grant select on public.daily_notes to authenticated;

-- I due ruoli possono scrivere tramite RPC; un ritentativo mantiene lo stesso
-- identificativo e non ricrea una nota già rimossa da uno dei due account.
create function public.add_daily_note(
  client_id uuid, note_day date, note_text text, created_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.daily_notes;
  text_value text := btrim(note_text, E' \t\n\r');
begin
  if auth.uid() is null or coalesce(private.role(), '') not in ('player', 'admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  if client_id is null or text_value is null or length(note_text) > 2000
    or length(text_value) < 1 or text_value ~ '^[[:space:]]*$'
    or note_day is null or note_day not between date '0001-01-01' and date '9999-12-31'
    or created_at is null or not isfinite(created_at) then
    raise exception 'Controlla la giornata e il testo della nota (massimo 2000 caratteri).' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('daily-note:' || client_id::text, 0));
  select * into previous from public.daily_notes where id = client_id;
  if found then
    if previous.created_by <> auth.uid() or previous.day <> note_day
      or previous.text <> text_value or previous.created_at <> add_daily_note.created_at then
      raise exception 'Identificativo già usato con dati diversi.' using errcode = '22023';
    end if;
    return;
  end if;
  insert into public.daily_notes(id, day, text, created_at, created_by)
    values (client_id, note_day, text_value, add_daily_note.created_at, auth.uid());
end $$;

create function public.remove_daily_note(client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(private.role(), '') not in ('player', 'admin') then
    raise exception 'Accesso non autorizzato.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('daily-note:' || client_id::text, 0));
  update public.daily_notes set removed_at = coalesce(removed_at, clock_timestamp()),
    removed_by = coalesce(removed_by, auth.uid()) where id = client_id;
  if not found then raise exception 'Nota non trovata.' using errcode = '22023'; end if;
end $$;

revoke all on function public.add_daily_note(uuid, date, text, timestamptz),
  public.remove_daily_note(uuid) from public, anon, authenticated;
grant execute on function public.add_daily_note(uuid, date, text, timestamptz),
  public.remove_daily_note(uuid) to authenticated;

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
    'notes', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'day', to_char(day, 'YYYY-MM-DD'), 'text', text, 'createdAt', created_at, 'removedAt', removed_at)) order by day, created_at, id) from public.daily_notes), '[]'::jsonb),
    'combos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'firstSurname', first_surname, 'secondSurname', second_surname, 'note', note, 'createdAt', created_at, 'removedAt', removed_at)) order by created_at, id) from public.surname_combos), '[]'::jsonb),
    'awards', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'rewardId', reward_id, 'name', name, 'description', description, 'target', target, 'period', period, 'periodKey', period_key, 'achievedAt', achieved_at, 'revokedAt', revoked_at, 'deliveredAt', delivered_at, 'needsReview', needs_review)) order by achieved_at desc) from public.awards where owner_id = owner), '[]'::jsonb)
  ) into result;
  return result;
end $$;



commit;
