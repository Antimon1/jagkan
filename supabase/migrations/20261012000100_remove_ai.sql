-- AI is removed from JagKan! (docs/idepanel-helhetsanalys.md). The library replaces
-- AI suggestions, collector cards always use the template text, and no data about
-- the children leaves the EU.

-- Existing rows follow src/domain/upgrade.ts: AI challenges become custom
-- challenges, and suggestions still waiting for a free slot become paused.
update public.child_challenges set source = 'custom' where source = 'ai';
update public.child_challenges set status = 'paused' where status = 'suggested';

alter table public.child_challenges drop constraint child_challenges_status_check;
alter table public.child_challenges add constraint child_challenges_status_check
  check (status in ('active', 'requested', 'completed', 'paused', 'archived'));
alter table public.child_challenges drop constraint child_challenges_source_check;
alter table public.child_challenges add constraint child_challenges_source_check
  check (source in ('library', 'custom'));

-- Functions first: SQL function bodies are not tracked as dependencies of the tables.
create or replace function public.jk_family_snapshot(p_family_id uuid, p_child_ids uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_family jsonb;
  v_device boolean := p_child_ids is not null;
begin
  select to_jsonb(f) into v_family from public.families f where f.id = p_family_id;
  if v_family is null then
    return null;
  end if;
  return jsonb_build_object(
    'family', v_family,
    'competitions', (select to_jsonb(c) from public.competitions c where c.family_id = p_family_id),
    'parents', case when v_device then '[]'::jsonb else public.jk_rows('parents', p_family_id, null) end,
    'children', public.jk_rows('children', p_family_id, null),
    'challenges', public.jk_rows('child_challenges', p_family_id, p_child_ids),
    'attempts', public.jk_rows('attempts', p_family_id, p_child_ids),
    'completions', public.jk_rows('completions', p_family_id, p_child_ids),
    'creatures', public.jk_rows('child_creatures', p_family_id, p_child_ids),
    'milestones', public.jk_rows('child_milestones', p_family_id, p_child_ids),
    'ledger', public.jk_rows('star_ledger', p_family_id, null),
    'rewards', public.jk_rows('rewards', p_family_id, null),
    'rewardRequests', public.jk_rows('reward_requests', p_family_id, p_child_ids),
    'goals', public.jk_rows('family_goals', p_family_id, null),
    'weeklyResults', public.jk_rows('weekly_results', p_family_id, null),
    'celebrations', public.jk_rows('celebrations', p_family_id, p_child_ids)
  );
end $$;

create or replace function public.jk_diff_tables() returns text[]
language sql immutable as $$
  select array[
    'children', 'child_challenges', 'attempts', 'completions', 'child_creatures', 'child_milestones', 'star_ledger',
    'rewards', 'reward_requests', 'family_goals', 'weekly_results', 'celebrations'
  ]
$$;

create or replace function public.jk_cleanup() returns void
language sql security definer set search_path = '' as $$
  delete from public.pairing_codes where expires_at < now();
  delete from public.code_failures where created_at < now() - interval '1 day';
  delete from public.parent_invites where expires_at < now() - interval '30 days';
  delete from public.applied_commands where created_at < now() - interval '30 days';
$$;

drop function public.jk_ai_take(uuid, uuid, int, int);

drop table public.ai_suggestions;
drop table public.ai_usage;
drop table public.ai_child_usage;
