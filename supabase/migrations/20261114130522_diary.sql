-- Initial application schema. Apply once, through the Supabase CLI or SQL editor.
-- Roles are provisioned separately by the project owner, never by browser code.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role text not null unique check (role in ('player', 'admin'))
);
create table public.events (
  id uuid primary key,
  version integer not null check (version > 0),
  archived boolean not null default false
);
create table public.event_versions (
  event_id uuid not null references public.events(id),
  version integer not null check (version > 0),
  name text not null check (length(btrim(name)) between 1 and 60),
  description text not null check (length(description) <= 180),
  points integer not null check (points between -1000 and 1000),
  valid_from timestamptz not null default clock_timestamp(),
  valid_until timestamptz,
  primary key (event_id, version)
);
create table public.rewards (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 1 and 60),
  description text not null check (length(description) <= 180),
  target integer not null check (target between 1 and 100000),
  period text not null check (period in ('week', 'all')),
  version integer not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  archived boolean not null default false
);
create table public.entries (
  owner_id uuid not null references public.profiles(id),
  id uuid not null,
  event_id uuid not null,
  event_version integer not null,
  name text not null,
  points integer not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  voided_at timestamptz,
  primary key (owner_id, id),
  foreign key (event_id, event_version) references public.event_versions(event_id, version)
);
create index entries_owner_time on public.entries(owner_id, occurred_at);
create table public.awards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  reward_id uuid not null references public.rewards(id),
  reward_version integer not null,
  name text not null,
  description text not null,
  target integer not null,
  period text not null,
  period_key text not null,
  achieved_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  delivered_at timestamptz,
  needs_review boolean not null default false,
  unique (owner_id, reward_id, period_key)
);
create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target_id uuid not null,
  details jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);

create function private.role() returns text language sql stable security definer
set search_path = '' as $$ select role from public.profiles where id = auth.uid() $$;

create function private.week_key(at_time timestamptz) returns text language sql immutable
set search_path = '' as $$ select to_char(date_trunc('week', at_time at time zone 'Europe/Rome'), 'YYYY-MM-DD') $$;

create function private.points_for(owner uuid, period_name text, key text) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(points), 0) from public.entries
  where owner_id = owner and voided_at is null
    and (period_name = 'all' or private.week_key(occurred_at) = key)
$$;

-- Caller must hold the player's profile row lock. This serializes all player mutations.
create function private.reconcile_awards(owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.rewards; a public.awards; k text; total bigint;
begin
  -- Existing awards always retain their historical conditions, including archived ones.
  for a in select * from public.awards where owner_id = owner for update loop
    total := private.points_for(owner, a.period, a.period_key);
    update public.awards set
      revoked_at = case when total < a.target and delivered_at is null then coalesce(revoked_at, clock_timestamp()) else null end,
      needs_review = (total < a.target and delivered_at is not null)
    where id = a.id;
  end loop;
  for r in select * from public.rewards where not archived loop
    for k in
      select 'all' where r.period = 'all'
      union select distinct private.week_key(occurred_at) from public.entries where owner_id = owner and r.period = 'week' and private.week_key(occurred_at) >= private.week_key(r.updated_at)
    loop
      total := private.points_for(owner, r.period, k);
      if total >= r.target then
        insert into public.awards(owner_id, reward_id, reward_version, name, description, target, period, period_key)
        values (owner, r.id, r.version, r.name, r.description, r.target, r.period, k)
        on conflict (owner_id, reward_id, period_key) do nothing;
      end if;
    end loop;
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_versions enable row level security;
alter table public.rewards enable row level security;
alter table public.entries enable row level security;
alter table public.awards enable row level security;
alter table public.admin_audit enable row level security;
grant usage on schema private to authenticated;
grant execute on function private.role() to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or private.role() = 'admin');
create policy events_read on public.events for select to authenticated using (private.role() in ('player', 'admin'));
create policy event_versions_read on public.event_versions for select to authenticated using (private.role() in ('player', 'admin'));
create policy rewards_read on public.rewards for select to authenticated using (private.role() in ('player', 'admin'));
create policy entries_read on public.entries for select to authenticated using (owner_id = auth.uid() or private.role() = 'admin');
create policy awards_read on public.awards for select to authenticated using (owner_id = auth.uid() or private.role() = 'admin');
create policy audit_read on public.admin_audit for select to authenticated using (private.role() = 'admin');

-- Explicitly remove Supabase's default table/function privileges.
revoke all on public.profiles, public.events, public.event_versions, public.rewards, public.entries, public.awards, public.admin_audit from anon, authenticated;
grant select on public.profiles, public.events, public.event_versions, public.rewards, public.entries, public.awards, public.admin_audit to authenticated;

create function public.diary_snapshot() returns jsonb
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
    'awards', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'rewardId', reward_id, 'name', name, 'description', description, 'target', target, 'period', period, 'periodKey', period_key, 'achievedAt', achieved_at, 'revokedAt', revoked_at, 'deliveredAt', delivered_at, 'needsReview', needs_review)) order by achieved_at desc) from public.awards where owner_id = owner), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.record_episode(client_id uuid, event_id uuid, event_version integer, occurred_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); previous public.entries; rule public.event_versions;
begin
  if private.role() is distinct from 'player' then raise exception 'Solo la giocatrice può segnare episodi.' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = owner for update;
  select * into previous from public.entries e where e.owner_id = owner and e.id = client_id;
  if found then
    if previous.event_id <> record_episode.event_id or previous.event_version <> record_episode.event_version or previous.occurred_at <> record_episode.occurred_at then
      raise exception 'Identificativo già usato con dati diversi.' using errcode = '22023';
    end if;
    return;
  end if;
  if occurred_at is null or occurred_at < clock_timestamp() - interval '7 days' or occurred_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'Data fuori intervallo: invia entro 7 giorni e verifica l’orologio del telefono.' using errcode = '22023';
  end if;
  select * into rule from public.event_versions v where v.event_id = record_episode.event_id and v.version = record_episode.event_version;
  if not found or occurred_at < rule.valid_from or (rule.valid_until is not null and occurred_at >= rule.valid_until) then
    raise exception 'La regola non era valida alla data dell’episodio. La registrazione resta da correggere.' using errcode = '22023';
  end if;
  insert into public.entries(owner_id, id, event_id, event_version, name, points, occurred_at)
    values (owner, client_id, rule.event_id, rule.version, rule.name, rule.points, record_episode.occurred_at);
  perform private.reconcile_awards(owner);
end $$;

create function public.void_episode(client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid();
begin
  if private.role() is distinct from 'player' then raise exception 'Solo la giocatrice può annullare i propri episodi.' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = owner for update;
  update public.entries set voided_at = coalesce(voided_at, clock_timestamp()) where owner_id = owner and id = client_id;
  if not found then raise exception 'Episodio non trovato.' using errcode = '22023'; end if;
  perform private.reconcile_awards(owner);
end $$;

create function public.manage_diary(operation_id uuid, command jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare kind text := command->>'type'; value jsonb := command->'value'; target_uuid uuid;
  previous_event public.events; previous_reward public.rewards; expected integer;
  previous_command jsonb; owner uuid; transition_at timestamptz;
begin
  if private.role() is distinct from 'admin' then raise exception 'Operazione riservata all’admin.' using errcode = '42501'; end if;
  -- The same lock order as player writes avoids interleaved awards/catalog changes.
  select id into owner from public.profiles where role = 'player' for update;
  perform 1 from public.profiles where id = auth.uid() for update;
  select details into previous_command from public.admin_audit where target_id = operation_id and action = 'command';
  if found then
    if previous_command <> command then raise exception 'Operazione già usata con dati diversi.' using errcode = '22023'; end if;
    return;
  end if;
  target_uuid := coalesce(value->>'id', command->>'id')::uuid;
  if target_uuid is null then raise exception 'Identificativo mancante.' using errcode = '22023'; end if;
  if kind in ('save-event', 'archive-event') then
    select * into previous_event from public.events where id = target_uuid for update;
    expected := coalesce((command->>'expectedVersion')::integer, 0);
    if coalesce(previous_event.version, 0) <> expected then raise exception 'Il catalogo è cambiato. Ricarica prima di salvare.' using errcode = '40001'; end if;
    if previous_event.archived then raise exception 'Evento già archiviato.' using errcode = '22023'; end if;
    transition_at := clock_timestamp();
    if kind = 'save-event' then
      insert into public.events(id, version) values (target_uuid, 1) on conflict (id) do update set version = public.events.version + 1;
      update public.event_versions set valid_until = transition_at where event_id = target_uuid and valid_until is null;
      insert into public.event_versions(event_id, version, name, description, points, valid_from)
        select target_uuid, version, btrim(value->>'name'), btrim(coalesce(value->>'description', '')), (value->>'points')::integer, transition_at from public.events where id = target_uuid;
    else
      if previous_event.id is null then raise exception 'Evento non trovato.' using errcode = '22023'; end if;
      update public.events set archived = true where id = target_uuid;
      update public.event_versions set valid_until = transition_at where event_id = target_uuid and valid_until is null;
    end if;
  elsif kind in ('save-reward', 'archive-reward') then
    select * into previous_reward from public.rewards where id = target_uuid for update;
    expected := coalesce((command->>'expectedVersion')::integer, 0);
    if coalesce(previous_reward.version, 0) <> expected then raise exception 'Il premio è cambiato. Ricarica prima di salvare.' using errcode = '40001'; end if;
    if previous_reward.archived then raise exception 'Premio già archiviato.' using errcode = '22023'; end if;
    if kind = 'save-reward' then
      insert into public.rewards(id, name, description, target, period)
      values (target_uuid, btrim(value->>'name'), btrim(coalesce(value->>'description', '')), (value->>'target')::integer, value->>'period')
      on conflict (id) do update set name = excluded.name, description = excluded.description, target = excluded.target, period = excluded.period, version = public.rewards.version + 1, updated_at = clock_timestamp();
    else
      if previous_reward.id is null then raise exception 'Premio non trovato.' using errcode = '22023'; end if;
      update public.rewards set archived = true where id = target_uuid;
    end if;
  elsif kind = 'deliver-award' then
    update public.awards set delivered_at = coalesce(delivered_at, clock_timestamp()) where id = target_uuid and revoked_at is null and not needs_review;
    if not found then raise exception 'Premio non disponibile per la consegna.' using errcode = '22023'; end if;
  else raise exception 'Operazione non valida.' using errcode = '22023';
  end if;
  insert into public.admin_audit(actor_id, action, target_id, details) values (auth.uid(), 'command', operation_id, command);
  if owner is not null then perform private.reconcile_awards(owner); end if;
end $$;

-- Public RPC surface: internal functions are never directly executable by visitors.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.role() to authenticated;
revoke all on function public.diary_snapshot(), public.record_episode(uuid, uuid, integer, timestamptz), public.void_episode(uuid), public.manage_diary(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.diary_snapshot(), public.record_episode(uuid, uuid, integer, timestamptz), public.void_episode(uuid), public.manage_diary(uuid, jsonb) to authenticated;
commit;
