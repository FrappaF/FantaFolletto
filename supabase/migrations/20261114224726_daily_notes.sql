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

-- Conserva la funzione precedente con controlli e campi già attivi (categorie,
-- bonus e versioni). Il nuovo snapshot aggiunge soltanto la raccolta richiesta.
alter function public.diary_snapshot() rename to diary_snapshot_before_notes;
alter function public.diary_snapshot_before_notes() set schema private;
revoke all on function private.diary_snapshot_before_notes() from public, anon, authenticated;

create function public.diary_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return private.diary_snapshot_before_notes() || jsonb_build_object(
    'notes', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', id, 'day', to_char(day, 'YYYY-MM-DD'), 'text', text, 'createdAt', created_at, 'removedAt', removed_at)) order by day, created_at, id) from public.daily_notes), '[]'::jsonb)
  );
end $$;
revoke all on function public.diary_snapshot() from public, anon, authenticated;
grant execute on function public.diary_snapshot() to authenticated;

commit;
