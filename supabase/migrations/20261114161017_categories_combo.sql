begin;
create table public.event_categories (
  id text primary key,
  name text not null check (length(btrim(name)) between 1 and 60),
  icon text not null check (length(icon) between 1 and 16),
  sort_order integer not null check (sort_order between 0 and 1000)
);
insert into public.event_categories values
 ('encounters','Incontri e gentilezze','☕',1), ('animals','Animali di casa','🐾',2),
 ('wins','Piccole vittorie','💚',3), ('mishaps','Imprevisti e scene buffe','😅',4),
 ('incredible','Incontri incredibili','🦄',5), ('challenges','Sfide','🏆',6);
alter table public.event_versions
 add column category_id text not null default 'mishaps' references public.event_categories(id),
 add column rarity text not null default 'normal' check (rarity in ('normal','rare','legendary')),
 add column repeat_rule text not null default 'unlimited' check (repeat_rule in ('unlimited','daily'));
create index event_versions_category_idx on public.event_versions(category_id);
create table public.scoring_rules (
 version integer primary key check (version > 0),
 effective_day date not null,
 increment_percent integer not null check (increment_percent between 0 and 1000),
 max_multiplier numeric not null check (max_multiplier between 1 and 20 and max_multiplier = round(max_multiplier,1)),
 created_at timestamptz not null default clock_timestamp()
);
create index scoring_rules_effective_idx on public.scoring_rules(effective_day desc, version desc);
-- Historical episodes and late sends from earlier days keep the original scoring.
insert into public.scoring_rules values (1, '1970-01-01', 0, 1, clock_timestamp()),
 (2, (clock_timestamp() at time zone 'Europe/Rome')::date, 20, 3, clock_timestamp());
alter table public.entries
 add column base_points integer,
 add column combo_index integer check (combo_index > 0),
 add column bonus_points integer check (bonus_points >= 0),
 add column scoring_version integer references public.scoring_rules(version);
create index entries_scoring_version_idx on public.entries(scoring_version);
create index entries_event_day_idx on public.entries(owner_id,event_id,occurred_at) where voided_at is null;
alter table public.event_categories enable row level security;
alter table public.scoring_rules enable row level security;
create policy categories_read on public.event_categories for select to authenticated using ((select private.role()) in ('admin','player'));
create policy scoring_read on public.scoring_rules for select to authenticated using ((select private.role()) in ('admin','player'));
revoke all on public.event_categories, public.scoring_rules from public, anon, authenticated;
grant select on public.event_categories, public.scoring_rules to authenticated;

-- Retain the already audited RPC implementations behind the private schema.
alter function public.diary_snapshot() set schema private;
alter function private.diary_snapshot() rename to legacy_diary_snapshot;
alter function public.manage_diary(uuid,jsonb) set schema private;
alter function private.manage_diary(uuid,jsonb) rename to legacy_manage_diary;
revoke all on function private.legacy_diary_snapshot(), private.legacy_manage_diary(uuid,jsonb) from public, anon, authenticated;

create function public.diary_snapshot() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; owner uuid;
begin
 result := private.legacy_diary_snapshot(); -- Performs the profile/role checks first.
 owner := (result->>'ownerId')::uuid;
 return result || jsonb_build_object(
 'categories', (select jsonb_agg(jsonb_build_object('id',id,'name',name,'icon',icon,'order',sort_order) order by sort_order,id) from public.event_categories),
 'scoringRules', (select jsonb_agg(jsonb_build_object('version',version,'effectiveDay',effective_day,'incrementPercent',increment_percent,'maxMultiplier',max_multiplier) order by version) from public.scoring_rules),
 'events', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',v.name,'description',v.description,'points',v.points,'version',e.version,'archived',e.archived,'categoryId',v.category_id,'rarity',v.rarity,'repeat',v.repeat_rule) order by c.sort_order,v.valid_from,e.id) from public.events e join public.event_versions v on v.event_id=e.id and v.version=e.version join public.event_categories c on c.id=v.category_id),'[]'::jsonb),
 'entries', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'eventId',event_id,'eventVersion',event_version,'name',name,'points',points,'basePoints',base_points,'comboIndex',combo_index,'bonusPoints',bonus_points,'scoringVersion',scoring_version,'occurredAt',occurred_at,'receivedAt',received_at,'voidedAt',voided_at)) order by occurred_at,id) from public.entries where owner_id=owner),'[]'::jsonb));
end $$;

-- Caller holds the player's profile lock. Recalculate only the affected event/day.
-- The settings version belongs to each entry, so admin edits never rewrite history.
create function private.recalculate_combo(owner uuid, target_event uuid, target_day date) returns void
language sql set search_path = '' as $$
 with positions as (
  select e.id, row_number() over(order by e.occurred_at,e.id)::integer as position
  from public.entries e where e.owner_id=owner and e.event_id=target_event and e.voided_at is null
   and e.occurred_at >= (target_day::timestamp at time zone 'Europe/Rome')
   and e.occurred_at < ((target_day + 1)::timestamp at time zone 'Europe/Rome')
 ), totals as (
  select e.id,p.position, case when e.base_points > 0 then round(e.base_points * least(r.max_multiplier, 1 + (p.position - 1)::numeric*r.increment_percent/100))::integer else e.base_points end as total
  from positions p join public.entries e on e.owner_id=owner and e.id=p.id join public.scoring_rules r on r.version=e.scoring_version
 )
 update public.entries e set points=t.total,combo_index=t.position,bonus_points=t.total-e.base_points
 from totals t where e.owner_id=owner and e.id=t.id;
$$;
create or replace function public.record_episode(client_id uuid, event_id uuid, event_version integer, occurred_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); previous public.entries; rule public.event_versions; scoring public.scoring_rules; local_day date; count_today integer;
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
  local_day := (record_episode.occurred_at at time zone 'Europe/Rome')::date;
  select * into scoring from public.scoring_rules where effective_day <= local_day order by effective_day desc,version desc limit 1;
  select count(*) into count_today from public.entries e where e.owner_id=owner and e.event_id=rule.event_id and e.voided_at is null
   and e.occurred_at >= (local_day::timestamp at time zone 'Europe/Rome') and e.occurred_at < ((local_day+1)::timestamp at time zone 'Europe/Rome');
  if rule.repeat_rule='daily' and count_today > 0 then raise exception 'Questa sfida è già stata segnata oggi.' using errcode='22023'; end if;
  insert into public.entries(owner_id,id,event_id,event_version,name,points,occurred_at,base_points,combo_index,bonus_points,scoring_version)
    values (owner,client_id,rule.event_id,rule.version,rule.name,rule.points,record_episode.occurred_at,rule.points,count_today+1,0,case when rule.repeat_rule='unlimited' then scoring.version else null end);
  perform private.recalculate_combo(owner,rule.event_id,local_day);
  perform private.reconcile_awards(owner);
end $$;

create or replace function public.void_episode(client_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); episode public.entries;
begin
  if private.role() is distinct from 'player' then raise exception 'Solo la giocatrice può annullare i propri episodi.' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = owner for update;
  update public.entries set voided_at = coalesce(voided_at, clock_timestamp()) where owner_id = owner and id = client_id;
  if not found then raise exception 'Episodio non trovato.' using errcode = '22023'; end if;
  select * into episode from public.entries where owner_id=owner and id=client_id;
  perform private.recalculate_combo(owner,episode.event_id,(episode.occurred_at at time zone 'Europe/Rome')::date);
  perform private.reconcile_awards(owner);
end $$;


create function public.manage_diary(operation_id uuid, command jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare kind text := command->>'type'; value jsonb := command->'value'; owner uuid; previous jsonb;
 current_version integer; target uuid; old_rule public.event_versions; next_version integer;
begin
 if private.role() is distinct from 'admin' then raise exception 'Operazione riservata all’admin.' using errcode='42501'; end if;
 select id into owner from public.profiles where role='player' for update;
 perform 1 from public.profiles where id=auth.uid() for update;
 select details into previous from public.admin_audit where target_id=operation_id and action='command';
 if found then
  if previous <> command then raise exception 'Operazione già usata con dati diversi.' using errcode='22023'; end if;
  return;
 end if;
 if kind='save-scoring' then
  select max(version) into current_version from public.scoring_rules;
  if coalesce((command->>'expectedVersion')::integer,0) <> current_version then raise exception 'Le regole sono cambiate. Ricarica prima di salvare.' using errcode='40001'; end if;
  if value->>'incrementPercent' is null or value->>'maxMultiplier' is null then raise exception 'Impostazioni mancanti.' using errcode='22023'; end if;
  -- Numeric validation is explicit: PostgreSQL casts decimal JSON numbers to rounded integers.
  if (value->>'incrementPercent')::numeric <> trunc((value->>'incrementPercent')::numeric) then raise exception 'La percentuale deve essere intera.' using errcode='22023'; end if;
  insert into public.scoring_rules(version,effective_day,increment_percent,max_multiplier)
   values (current_version+1,(clock_timestamp() at time zone 'Europe/Rome')::date+1,(value->>'incrementPercent')::integer,(value->>'maxMultiplier')::numeric);
  insert into public.admin_audit(actor_id,action,target_id,details) values(auth.uid(),'command',operation_id,command);
 elsif kind='save-event' then
  target := (value->>'id')::uuid;
  select v.* into old_rule from public.event_versions v join public.events e on e.id=v.event_id and e.version=v.version where e.id=target;
  perform private.legacy_manage_diary(operation_id,command);
  update public.event_versions v set category_id=coalesce(value->>'categoryId',old_rule.category_id,'mishaps'),rarity=coalesce(value->>'rarity',old_rule.rarity,'normal'),repeat_rule=coalesce(value->>'repeat',old_rule.repeat_rule,'unlimited')
   from public.events e where e.id=target and v.event_id=e.id and v.version=e.version;
 else
  perform private.legacy_manage_diary(operation_id,command);
 end if;
end $$;
revoke all on function private.recalculate_combo(uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.diary_snapshot(),public.manage_diary(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.diary_snapshot(),public.manage_diary(uuid,jsonb) to authenticated;
commit;
