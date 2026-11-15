-- Riscatto scelto dalla giocatrice, saldo spendibile e massimale storico.
begin;

alter table public.awards
  add column redeemed_at timestamptz,
  add column points_spent integer,
  add constraint awards_redemption_cost check (
    (redeemed_at is null and points_spent is null) or
    (redeemed_at is not null and points_spent is not null and points_spent = target and points_spent between 1 and 100000)
  );
-- Le assegnazioni automatiche precedenti restano intatte e non sono addebitate.
alter table public.awards drop constraint awards_owner_id_reward_id_period_key_key;
create unique index awards_redeemed_period_idx on public.awards(owner_id, reward_id, period_key)
  where redeemed_at is not null or delivered_at is not null;

create table public.point_balances (
  owner_id uuid primary key references public.profiles(id),
  current_points bigint not null,
  maximum_points bigint not null check (maximum_points >= 0)
);
alter table public.point_balances enable row level security;
create policy point_balances_read on public.point_balances for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.role()) = 'admin');
revoke all on public.point_balances from public, anon, authenticated;
grant select on public.point_balances to authenticated;

-- Il chiamante mantiene il lock del profilo della giocatrice, condiviso con
-- episodi, annullamenti e gestione catalogo. Nessuna doppia spesa concorrente.
create function private.refresh_point_balance(owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare earned bigint; spent bigint;
begin
  earned := private.points_for(owner, 'all', 'all');
  select coalesce(sum(points_spent), 0) into spent from public.awards where owner_id = owner;
  insert into public.point_balances(owner_id, current_points, maximum_points)
    values (owner, earned - spent, greatest(0, earned))
    on conflict (owner_id) do update set current_points = excluded.current_points,
      maximum_points = greatest(public.point_balances.maximum_points, excluded.maximum_points);
end $$;
revoke all on function private.refresh_point_balance(uuid) from public, anon, authenticated;

-- Nessuna nuova assegnazione automatica. Un annullamento può creare un debito:
-- si conserva il riscatto e si blocca nuova spesa fino al recupero dei punti.
create or replace function private.reconcile_awards(owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.awards; total bigint; balance bigint;
begin
  perform private.refresh_point_balance(owner);
  select current_points into balance from public.point_balances where owner_id = owner;
  for a in select * from public.awards where owner_id = owner for update loop
    if a.redeemed_at is not null then
      update public.awards set needs_review = (balance < 0), revoked_at = null where id = a.id;
    else
      total := private.points_for(owner, a.period, a.period_key);
      update public.awards set
        revoked_at = case when total < a.target and delivered_at is null then coalesce(revoked_at, clock_timestamp()) else null end,
        needs_review = (total < a.target and delivered_at is not null)
      where id = a.id;
    end if;
  end loop;
end $$;
revoke all on function private.reconcile_awards(uuid) from public, anon, authenticated;

create function public.redeem_reward(client_id uuid, reward_id uuid, expected_version integer, period_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); previous public.awards; r public.rewards;
  balance bigint; current_key text; redeemed_time timestamptz := clock_timestamp();
begin
  if owner is null or private.role() is distinct from 'player' then
    raise exception 'Solo la giocatrice può riscattare i premi.' using errcode = '42501';
  end if;
  if client_id is null or reward_id is null or expected_version is null or period_key is null then
    raise exception 'Dati del riscatto mancanti.' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = owner for update;
  select * into previous from public.awards where id = client_id;
  if found then
    if previous.owner_id <> owner or previous.reward_id <> redeem_reward.reward_id
      or previous.reward_version <> expected_version or previous.period_key <> redeem_reward.period_key
      or previous.redeemed_at is null then
      raise exception 'Identificativo già usato con dati diversi.' using errcode = '22023';
    end if;
    return;
  end if;
  select * into r from public.rewards where id = redeem_reward.reward_id;
  if not found or r.archived then
    raise exception 'Premio non più disponibile.' using errcode = '22023';
  end if;
  if r.version <> expected_version then
    raise exception 'Il premio è cambiato. Ricarica prima di riscattare.' using errcode = '40001';
  end if;
  current_key := case when r.period = 'week' then private.week_key(redeemed_time) else 'all' end;
  if period_key <> current_key then
    raise exception 'Il periodo è cambiato. Ricarica il diario.' using errcode = '22023';
  end if;
  if exists(select 1 from public.awards a where a.owner_id = owner and a.reward_id = r.id
    and a.period_key = current_key and (a.redeemed_at is not null or a.delivered_at is not null)) then
    raise exception 'Premio già riscattato per questo periodo.' using errcode = '22023';
  end if;
  perform private.refresh_point_balance(owner);
  select current_points into balance from public.point_balances where owner_id = owner;
  if balance < r.target or (r.period = 'week' and private.points_for(owner, 'week', current_key) < r.target) then
    raise exception 'Punti insufficienti per riscattare questo premio.' using errcode = '22023';
  end if;
  insert into public.awards(id, owner_id, reward_id, reward_version, name, description, target, period, period_key, achieved_at, redeemed_at, points_spent)
    values (client_id, owner, r.id, r.version, r.name, r.description, r.target, r.period, current_key, redeemed_time, redeemed_time, r.target);
  perform private.reconcile_awards(owner);
end $$;
revoke all on function public.redeem_reward(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.redeem_reward(uuid, uuid, integer, text) to authenticated;

-- Anche i vecchi frontend devono passare da un riscatto prima della consegna.
alter function public.manage_diary(uuid, jsonb) rename to manage_diary_before_redemptions;
alter function public.manage_diary_before_redemptions(uuid, jsonb) set schema private;
revoke all on function private.manage_diary_before_redemptions(uuid, jsonb) from public, anon, authenticated;
create function public.manage_diary(operation_id uuid, command jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.role() is distinct from 'admin' then
    raise exception 'Operazione riservata all’admin.' using errcode = '42501';
  end if;
  perform 1 from public.profiles where role = 'player' for update;
  if command->>'type' = 'deliver-award' and not exists (
    select 1 from public.awards where id = (command->>'id')::uuid and redeemed_at is not null
  ) then
    raise exception 'La giocatrice deve prima riscattare il premio.' using errcode = '22023';
  end if;
  perform private.manage_diary_before_redemptions(operation_id, command);
end $$;
revoke all on function public.manage_diary(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.manage_diary(uuid, jsonb) to authenticated;

-- Saldo iniziale dai dati confermati. Non addebita le vecchie assegnazioni.
do $$ declare owner uuid; begin
  for owner in select id from public.profiles where role = 'player' for update loop
    perform private.refresh_point_balance(owner);
  end loop;
end $$;

alter function public.diary_snapshot() rename to diary_snapshot_before_redemptions;
alter function public.diary_snapshot_before_redemptions() set schema private;
revoke all on function private.diary_snapshot_before_redemptions() from public, anon, authenticated;
create function public.diary_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; owner uuid; earned bigint;
begin
  result := private.diary_snapshot_before_redemptions();
  owner := (result->>'ownerId')::uuid;
  earned := private.points_for(owner, 'all', 'all');
  return result || jsonb_build_object(
    'pointBalance', coalesce((select jsonb_build_object('current', current_points, 'maximum', maximum_points)
      from public.point_balances where owner_id = owner), jsonb_build_object('current', earned, 'maximum', greatest(0, earned))),
    'awards', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'rewardId', reward_id, 'rewardVersion', reward_version, 'name', name, 'description', description,
      'target', target, 'period', period, 'periodKey', period_key, 'achievedAt', achieved_at,
      'revokedAt', revoked_at, 'deliveredAt', delivered_at, 'needsReview', needs_review,
      'redeemedAt', redeemed_at, 'pointsSpent', points_spent)) order by achieved_at desc, id)
      from public.awards where owner_id = owner), '[]'::jsonb)
  );
end $$;
revoke all on function public.diary_snapshot() from public, anon, authenticated;
grant execute on function public.diary_snapshot() to authenticated;

commit;
