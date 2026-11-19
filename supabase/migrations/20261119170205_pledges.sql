-- Pegni settimanali/mensili: versioni future, riscossione admin e storico.
begin;

create table public.pledge_versions (
  id uuid not null,
  version integer not null check (version > 0),
  name text not null check (length(btrim(name)) between 1 and 60),
  description text not null check (length(description) <= 180),
  target integer not null check (target between 1 and 100000),
  period text not null check (period in ('week', 'month')),
  archived boolean not null default false,
  effective_from date not null check (effective_from between date '0001-01-01' and date '9999-12-31'),
  primary key (id, version),
  check ((period = 'week' and extract(isodow from effective_from) = 1)
    or (period = 'month' and extract(day from effective_from) = 1))
);
create table public.pledge_claims (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id),
  pledge_id uuid not null,
  pledge_version integer not null,
  name text not null,
  description text not null,
  target integer not null check (target between 1 and 100000),
  period text not null check (period in ('week', 'month')),
  period_key date not null,
  points bigint not null,
  redeemed_at timestamptz not null default clock_timestamp(),
  foreign key (pledge_id, pledge_version) references public.pledge_versions(id, version),
  unique (owner_id, pledge_id, period_key)
);
create index pledge_claims_version_idx on public.pledge_claims(pledge_id, pledge_version);
alter table public.pledge_versions enable row level security;
alter table public.pledge_claims enable row level security;
create policy pledge_versions_read on public.pledge_versions for select to authenticated
  using ((select private.role()) in ('player', 'admin'));
create policy pledge_claims_read on public.pledge_claims for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.role()) = 'admin');
revoke all on public.pledge_versions, public.pledge_claims from public, anon, authenticated;
grant select on public.pledge_versions, public.pledge_claims to authenticated;

create function private.pledge_period_start(period_name text, day_value date) returns date
language sql immutable set search_path = '' as $$
  select date_trunc(case when period_name = 'week' then 'week' else 'month' end, day_value::timestamp)::date
$$;
create function private.pledge_next_start(period_name text, day_value date) returns date
language sql immutable set search_path = '' as $$
  select (private.pledge_period_start(period_name, day_value)
    + case when period_name = 'week' then interval '7 days' else interval '1 month' end)::date
$$;
-- I confini sono mezzanotti italiane, non intervalli fissi di ore (ora legale).
create function private.pledge_points(owner uuid, period_name text, key_day date) returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(points), 0) from public.entries
  where owner_id = owner and voided_at is null
    and occurred_at >= (key_day::timestamp at time zone 'Europe/Rome')
    and occurred_at < (private.pledge_next_start(period_name, key_day)::timestamp at time zone 'Europe/Rome')
$$;
revoke all on function private.pledge_period_start(text, date),
  private.pledge_next_start(text, date), private.pledge_points(uuid, text, date)
  from public, anon, authenticated;

alter function public.manage_diary(uuid, jsonb) rename to manage_diary_before_pledges;
alter function public.manage_diary_before_pledges(uuid, jsonb) set schema private;
revoke all on function private.manage_diary_before_pledges(uuid, jsonb) from public, anon, authenticated;
create function public.manage_diary(operation_id uuid, command jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  kind text := command->>'type'; value jsonb := command->'value';
  owner uuid; target_uuid uuid; claim_uuid uuid; previous_command jsonb;
  previous public.pledge_versions; chosen public.pledge_versions; old_claim public.pledge_claims;
  expected integer; period_name text; key_day date; total bigint;
  today_rome date;
begin
  if auth.uid() is null or private.role() is distinct from 'admin' then
    raise exception 'Operazione riservata all’admin.' using errcode = '42501';
  end if;
  if kind is null or kind not in ('save-pledge', 'archive-pledge', 'redeem-pledge') then
    perform private.manage_diary_before_pledges(operation_id, command);
    return;
  end if;
  if operation_id is null then
    raise exception 'Identificativo dell’operazione mancante.' using errcode = '22023';
  end if;
  -- Stesso ordine di lock di episodi e catalogo, per verificare punti e versione insieme.
  select id into owner from public.profiles where role = 'player' for update;
  if owner is null then raise exception 'La giocatrice non è ancora configurata.' using errcode = '22023'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  today_rome := (clock_timestamp() at time zone 'Europe/Rome')::date;
  select details into previous_command from public.admin_audit
    where target_id = operation_id and action = 'command';
  if found then
    if previous_command <> command then
      raise exception 'Operazione già usata con dati diversi.' using errcode = '22023';
    end if;
    return;
  end if;
  expected := (command->>'expectedVersion')::integer;
  if expected is null then
    raise exception 'Versione del pegno mancante.' using errcode = '22023';
  end if;
  if kind in ('save-pledge', 'archive-pledge') then
    target_uuid := case when kind = 'save-pledge' then value->>'id' else command->>'id' end;
    if target_uuid is null then raise exception 'Identificativo mancante.' using errcode = '22023'; end if;
    select * into previous from public.pledge_versions where id = target_uuid order by version desc limit 1;
    if coalesce(previous.version, 0) <> expected then
      raise exception 'Il pegno è cambiato. Ricarica prima di salvare.' using errcode = '40001';
    end if;
    if previous.archived then raise exception 'Pegno già archiviato.' using errcode = '22023'; end if;
    if kind = 'save-pledge' then
      period_name := value->>'period';
      if period_name is null or period_name not in ('week', 'month') then
        raise exception 'Periodo non valido.' using errcode = '22023';
      end if;
      if previous.id is not null and previous.period <> period_name then
        raise exception 'Il periodo di un pegno esistente non può cambiare. Crea un nuovo pegno.' using errcode = '22023';
      end if;
      insert into public.pledge_versions(id, version, name, description, target, period, effective_from)
        values (target_uuid, expected + 1, btrim(value->>'name', E' \t\n\r'),
          btrim(coalesce(value->>'description', ''), E' \t\n\r'), (value->>'target')::integer,
          period_name, private.pledge_next_start(period_name, today_rome));
    else
      if previous.id is null then raise exception 'Pegno non trovato.' using errcode = '22023'; end if;
      insert into public.pledge_versions(id, version, name, description, target, period, archived, effective_from)
        values (target_uuid, expected + 1, previous.name, previous.description, previous.target,
          previous.period, true, private.pledge_next_start(previous.period, today_rome));
    end if;
  else
    target_uuid := (command->>'pledgeId')::uuid;
    claim_uuid := (command->>'id')::uuid;
    if target_uuid is null or claim_uuid is null or coalesce(command->>'periodKey', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Dati della riscossione mancanti o non validi.' using errcode = '22023';
    end if;
    key_day := (command->>'periodKey')::date;
    select * into old_claim from public.pledge_claims where id = claim_uuid;
    if found then
      if old_claim.owner_id <> owner or old_claim.pledge_id <> target_uuid
        or old_claim.pledge_version <> expected or old_claim.period_key <> key_day then
        raise exception 'Identificativo già usato con dati diversi.' using errcode = '22023';
      end if;
    else
      select * into chosen from public.pledge_versions
        where id = target_uuid and effective_from <= key_day
        order by effective_from desc, version desc limit 1;
      if chosen.id is null or chosen.archived then
        raise exception 'Pegno non disponibile per questo periodo.' using errcode = '22023';
      end if;
      if chosen.version <> expected then
        raise exception 'Il pegno è cambiato. Ricarica prima di riscuotere.' using errcode = '40001';
      end if;
      if key_day <> private.pledge_period_start(chosen.period, key_day)
        or private.pledge_next_start(chosen.period, key_day) > today_rome then
        raise exception 'Il periodo del pegno non è ancora concluso o non è valido.' using errcode = '22023';
      end if;
      if exists(select 1 from public.pledge_claims where owner_id = owner
        and pledge_id = target_uuid and period_key = key_day) then
        raise exception 'Pegno già riscosso per questo periodo.' using errcode = '22023';
      end if;
      total := private.pledge_points(owner, chosen.period, key_day);
      if total >= chosen.target then
        raise exception 'La quota è stata raggiunta: questo pegno non è dovuto.' using errcode = '22023';
      end if;
      insert into public.pledge_claims(id, owner_id, pledge_id, pledge_version, name, description, target, period, period_key, points)
        values (claim_uuid, owner, target_uuid, chosen.version, chosen.name, chosen.description,
          chosen.target, chosen.period, key_day, total);
    end if;
  end if;
  insert into public.admin_audit(actor_id, action, target_id, details)
    values (auth.uid(), 'command', operation_id, command);
end $$;
revoke all on function public.manage_diary(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.manage_diary(uuid, jsonb) to authenticated;

alter function public.diary_snapshot() rename to diary_snapshot_before_pledges;
alter function public.diary_snapshot_before_pledges() set schema private;
revoke all on function private.diary_snapshot_before_pledges() from public, anon, authenticated;
create function public.diary_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; owner uuid;
begin
  result := private.diary_snapshot_before_pledges();
  owner := (result->>'ownerId')::uuid;
  return result || jsonb_build_object(
    'pledges', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'version', version, 'name', name, 'description', description, 'target', target,
      'period', period, 'archived', archived, 'effectiveFrom', to_char(effective_from, 'YYYY-MM-DD'))
      order by id, version) from public.pledge_versions), '[]'::jsonb),
    'pledgeClaims', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'pledgeId', pledge_id, 'pledgeVersion', pledge_version, 'name', name,
      'description', description, 'target', target, 'period', period,
      'periodKey', to_char(period_key, 'YYYY-MM-DD'), 'points', points, 'redeemedAt', redeemed_at,
      'needsReview', private.pledge_points(owner, period, period_key) >= target)
      order by redeemed_at, id) from public.pledge_claims where owner_id = owner), '[]'::jsonb)
  );
end $$;
revoke all on function public.diary_snapshot() from public, anon, authenticated;
grant execute on function public.diary_snapshot() to authenticated;

commit;
