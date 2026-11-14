-- Follow-up to the first hosted advisory review. Does not change game data.
begin;

create index entries_event_version_idx on public.entries(event_id, event_version);
create index awards_reward_idx on public.awards(reward_id);
create index admin_audit_actor_idx on public.admin_audit(actor_id);
create unique index admin_audit_command_operation_idx on public.admin_audit(target_id) where action = 'command';

-- Evaluate identity and role once per statement rather than once per row.
alter policy profiles_read on public.profiles using (id = (select auth.uid()) or (select private.role()) = 'admin');
alter policy events_read on public.events using ((select private.role()) in ('player', 'admin'));
alter policy event_versions_read on public.event_versions using ((select private.role()) in ('player', 'admin'));
alter policy rewards_read on public.rewards using ((select private.role()) in ('player', 'admin'));
alter policy entries_read on public.entries using (owner_id = (select auth.uid()) or (select private.role()) = 'admin');
alter policy awards_read on public.awards using (owner_id = (select auth.uid()) or (select private.role()) = 'admin');
alter policy audit_read on public.admin_audit using ((select private.role()) = 'admin');

-- The dashboard-created automatic RLS helper is an event trigger, not a public RPC.
-- Leave the trigger enabled; it does not need client EXECUTE privileges.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

commit;
