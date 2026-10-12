-- Row Level Security, snapshots and the RPCs the app calls (spec 11, 14.1).
--
-- Reads: parents see everything in their family. A paired child device sees its
-- own children's data plus the family's shared data (rewards, goals, weekly
-- results, stars for the duel) and never AI suggestions or other parents.
-- Writes: clients never write tables directly. Game changes go through the
-- Edge Function `game-action` (service role) and jk_apply_diff; account and
-- device changes go through the security-definer RPCs below.

-- ---------------------------------------------------------------------------
-- Who is calling?
-- ---------------------------------------------------------------------------

create function public.jk_parent_family() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.parents where id = auth.uid()
$$;

create function public.jk_device_family() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.child_devices where auth_user_id = auth.uid()
$$;

create function public.jk_device_children() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce((select child_ids from public.child_devices where auth_user_id = auth.uid()), '{}'::uuid[])
$$;

create function public.jk_is_anonymous() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (read-only policies; no client writes)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'challenge_templates', 'creatures', 'milestones', 'families', 'parents', 'children', 'child_challenges',
    'attempts', 'completions', 'child_creatures', 'child_milestones', 'star_ledger', 'rewards', 'reward_requests',
    'family_goals', 'competitions', 'weekly_results', 'ai_suggestions', 'celebrations', 'child_devices',
    'pairing_codes', 'code_failures', 'parent_invites', 'push_tokens', 'applied_commands', 'ai_usage',
    'ai_child_usage', 'plus_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy catalog_read on public.challenge_templates for select to anon, authenticated using (true);
create policy catalog_read on public.creatures for select to anon, authenticated using (true);
create policy catalog_read on public.milestones for select to anon, authenticated using (true);

create policy family_read on public.families for select to authenticated
  using (id = public.jk_parent_family() or id = public.jk_device_family());

create policy parent_read on public.parents for select to authenticated
  using (family_id = public.jk_parent_family());

create policy child_devices_read on public.child_devices for select to authenticated
  using (family_id = public.jk_parent_family());

create policy ai_suggestions_read on public.ai_suggestions for select to authenticated
  using (family_id = public.jk_parent_family());

-- Shared family data: parents and paired devices of the family.
do $$
declare
  t text;
begin
  foreach t in array array['children', 'star_ledger', 'rewards', 'family_goals', 'competitions', 'weekly_results'] loop
    execute format(
      'create policy family_shared_read on public.%I for select to authenticated
         using (family_id = public.jk_parent_family() or family_id = public.jk_device_family())', t);
  end loop;
end $$;

-- Per-child data: parents, or a device paired with that child.
do $$
declare
  t text;
begin
  foreach t in array array[
    'child_challenges', 'attempts', 'completions', 'child_creatures', 'child_milestones', 'reward_requests', 'celebrations'
  ] loop
    execute format(
      'create policy child_read on public.%I for select to authenticated
         using (family_id = public.jk_parent_family() or child_id = any (public.jk_device_children()))', t);
  end loop;
end $$;

-- Realtime (spec 14.1): the app refreshes when these tables change.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.families, public.child_challenges, public.completions, public.reward_requests, public.family_goals;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Snapshots
-- ---------------------------------------------------------------------------

-- Rows of one family table as a JSON array in insertion order, without `seq`.
create function public.jk_rows(p_table text, p_family_id uuid, p_child_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_child_filter text := '';
begin
  if p_child_ids is not null then
    v_child_filter := ' and t.child_id = any ($2)';
  end if;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) - ''seq'' order by t.seq), ''[]''::jsonb) from public.%I t where t.family_id = $1%s',
    p_table, v_child_filter)
    into v_result using p_family_id, p_child_ids;
  return v_result;
end $$;

-- The whole family (p_child_ids null: parent view) or a child device's view.
create function public.jk_family_snapshot(p_family_id uuid, p_child_ids uuid[] default null) returns jsonb
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
    'aiSuggestions', case when v_device then '[]'::jsonb else public.jk_rows('ai_suggestions', p_family_id, null) end,
    'celebrations', public.jk_rows('celebrations', p_family_id, p_child_ids)
  );
end $$;

-- What the signed-in parent or paired device may see (app: cloudBackend.load).
create function public.jk_my_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid := public.jk_parent_family();
  v_device public.child_devices;
begin
  if v_family is not null then
    return public.jk_family_snapshot(v_family, null);
  end if;
  update public.child_devices set last_seen = now() where auth_user_id = auth.uid() returning * into v_device;
  if v_device.id is not null then
    return public.jk_family_snapshot(v_device.family_id, v_device.child_ids);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Writing engine results (service role only)
-- ---------------------------------------------------------------------------

-- Tables jk_apply_diff may write, in dependency order (parents are managed by the RPCs).
create function public.jk_diff_tables() returns text[]
language sql immutable as $$
  select array[
    'children', 'child_challenges', 'attempts', 'completions', 'child_creatures', 'child_milestones', 'star_ledger',
    'rewards', 'reward_requests', 'family_goals', 'weekly_results', 'ai_suggestions', 'celebrations'
  ]
$$;

/*
 * Applies a StateDiff (src/domain/rows.ts) in one transaction.
 * Returns 'applied', 'duplicate' (command id seen before) or 'conflict' (the
 * family revision moved since the caller loaded it; the caller retries).
 */
create function public.jk_apply_diff(p_family_id uuid, p_expected_revision bigint, p_command_id uuid, p_diff jsonb)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_revision bigint;
  v_item jsonb;
  v_table text;
  v_rows jsonb;
  v_cols text;
  v_set text;
  v_inserted int;
begin
  select revision into v_revision from public.families where id = p_family_id for update;
  if not found then
    raise exception 'family not found' using errcode = 'P0002';
  end if;

  if p_command_id is not null then
    insert into public.applied_commands (family_id, id) values (p_family_id, p_command_id) on conflict (family_id, id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return 'duplicate';
    end if;
  end if;

  if v_revision <> p_expected_revision then
    -- Undo the idempotency key so the retry can record it.
    if p_command_id is not null then
      delete from public.applied_commands where family_id = p_family_id and id = p_command_id;
    end if;
    return 'conflict';
  end if;

  if jsonb_typeof(p_diff -> 'family') = 'object' then
    if (p_diff -> 'family' ->> 'id')::uuid is distinct from p_family_id then
      raise exception 'family mismatch' using errcode = '42501';
    end if;
    update public.families f
       set name = d.name, plus_active = d.plus_active, settings = d.settings, revision = d.revision
      from jsonb_populate_record(null::public.families, p_diff -> 'family') d
     where f.id = p_family_id;
  end if;

  if jsonb_typeof(p_diff -> 'competitions') = 'object' then
    insert into public.competitions (family_id, family_goal_enabled, sibling_duel_enabled, self_mode_enabled, handicaps)
    select p_family_id, d.family_goal_enabled, d.sibling_duel_enabled, d.self_mode_enabled, coalesce(d.handicaps, '{}')
      from jsonb_populate_record(null::public.competitions, p_diff -> 'competitions') d
    on conflict (family_id) do update
       set family_goal_enabled = excluded.family_goal_enabled,
           sibling_duel_enabled = excluded.sibling_duel_enabled,
           self_mode_enabled = excluded.self_mode_enabled,
           handicaps = excluded.handicaps;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_diff -> 'upserts', '[]'::jsonb)) loop
    v_table := v_item ->> 'table';
    v_rows := v_item -> 'rows';
    if not v_table = any (public.jk_diff_tables()) then
      raise exception 'table % is not writable', v_table using errcode = '42501';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_rows) r where (r.value ->> 'family_id')::uuid is distinct from p_family_id
    ) then
      raise exception 'row outside family' using errcode = '42501';
    end if;
    select string_agg(format('%I', attname), ', ' order by attnum),
           string_agg(format('%I = excluded.%I', attname, attname), ', ' order by attnum) filter (where attname <> 'id')
      into v_cols, v_set
      from pg_attribute
     where attrelid = format('public.%I', v_table)::regclass and attnum > 0 and not attisdropped and attname <> 'seq';
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)
       on conflict (id) do update set %3$s where public.%1$I.family_id = excluded.family_id',
      v_table, v_cols, v_set)
      using v_rows;
  end loop;

  -- Deletes in reverse dependency order.
  for v_item in
    select value from jsonb_array_elements(coalesce(p_diff -> 'deletes', '[]'::jsonb))
    order by array_position(public.jk_diff_tables(), value ->> 'table') desc
  loop
    v_table := v_item ->> 'table';
    if not v_table = any (public.jk_diff_tables()) then
      raise exception 'table % is not writable', v_table using errcode = '42501';
    end if;
    execute format('delete from public.%I where family_id = $1 and id = any ($2)', v_table)
      using p_family_id, array(select jsonb_array_elements_text(v_item -> 'ids'))::uuid[];
  end loop;

  return 'applied';
end $$;

-- ---------------------------------------------------------------------------
-- Accounts and families
-- ---------------------------------------------------------------------------

-- Must match DEFAULT_SETTINGS in src/domain/constants.ts (checked by supabase/tests).
create function public.jk_default_settings() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'sparkBonusEnabled', true,
    'maxActiveChallenges', 5,
    'soundEnabled', true,
    'speechEnabled', true,
    'locale', 'sv',
    'timeZone', 'Europe/Stockholm',
    'notifications', jsonb_build_object('approvals', true, 'weeklySummary', true, 'reminders', true, 'reminderHour', 17)
  )
$$;

create function public.jk_require_new_parent() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.jk_is_anonymous() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.parents where id = v_uid) then
    raise exception 'already_in_family' using errcode = '23505';
  end if;
  if exists (select 1 from public.child_devices where auth_user_id = v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_uid;
end $$;

create function public.jk_clean_name(p_value text, p_max int) returns text
language plpgsql immutable as $$
declare
  v text := btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g'));
begin
  if char_length(v) < 1 or char_length(v) > p_max then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  return v;
end $$;

create function public.jk_create_family(p_family_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.jk_require_new_parent();
  v_family uuid;
begin
  insert into public.families (name, settings)
  values (public.jk_clean_name(p_family_name, 50), public.jk_default_settings())
  returning id into v_family;
  insert into public.parents (id, family_id, role, display_name)
  values (v_uid, v_family, 'admin', public.jk_clean_name(p_display_name, 30));
  insert into public.competitions (family_id) values (v_family);
  return v_family;
end $$;

-- Random codes from gen_random_uuid() (no pgcrypto needed). Digits come from 32
-- random bits, so the modulo bias is negligible (p_length <= 9).
create function public.jk_random_digits(p_length int) returns text
language sql volatile as $$
  select lpad(
    ((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint) % (10 ^ p_length)::bigint)::text,
    p_length, '0')
$$;

create function public.jk_random_code(p_length int) returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 32, 1), '')
    from generate_series(1, p_length)
$$;

-- Co-parent invite (spec 10.11), admin only, valid 7 days.
create function public.jk_create_invite() returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid;
  v_code text;
  v_expires timestamptz := now() + interval '7 days';
begin
  select p.family_id into v_family from public.parents p where p.id = auth.uid() and p.role = 'admin';
  if v_family is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.parent_invites i where i.expires_at < now();
  loop
    v_code := public.jk_random_code(8);
    exit when not exists (select 1 from public.parent_invites i where i.code = v_code);
  end loop;
  insert into public.parent_invites (code, family_id, created_by, expires_at) values (v_code, v_family, auth.uid(), v_expires);
  return query select v_code, v_expires;
end $$;

-- Returns the family id, or null for an unknown/used/expired code (the failure is
-- recorded, so guessing is limited to 10 tries per 15 minutes per account).
create function public.jk_accept_invite(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.jk_require_new_parent();
  v_invite public.parent_invites;
  v_failures int;
begin
  perform pg_advisory_xact_lock(hashtext('jk_accept_invite:' || v_uid::text));
  select count(*) into v_failures from public.code_failures
   where auth_user_id = v_uid and kind = 'invite' and created_at > now() - interval '15 minutes';
  if v_failures >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select * into v_invite from public.parent_invites
   where code = upper(btrim(p_code)) and used_by is null and expires_at > now()
   for update;
  if v_invite.code is null then
    insert into public.code_failures (auth_user_id, kind) values (v_uid, 'invite');
    return null;
  end if;
  insert into public.parents (id, family_id, role, display_name)
  values (v_uid, v_invite.family_id, 'coparent', public.jk_clean_name(p_display_name, 30));
  update public.parent_invites set used_by = v_uid, used_at = now() where code = v_invite.code;
  update public.families set revision = revision + 1 where id = v_invite.family_id;
  return v_invite.family_id;
end $$;

-- ---------------------------------------------------------------------------
-- Child devices (spec 11)
-- ---------------------------------------------------------------------------

-- Six digits, valid 10 minutes, for the given children of the caller's family.
create function public.jk_create_pairing_code(p_child_ids uuid[]) returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid := public.jk_parent_family();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_family is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_child_ids), 0) = 0 or exists (
    select 1 from unnest(p_child_ids) as wanted (child_id)
     where not exists (select 1 from public.children c where c.id = wanted.child_id and c.family_id = v_family)
  ) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  delete from public.pairing_codes pc where pc.expires_at < now();
  -- At most 5 live codes per family (keeps guessing odds tiny): drop the oldest.
  delete from public.pairing_codes pc
   where pc.family_id = v_family
     and pc.code in (
       select old.code from public.pairing_codes old where old.family_id = v_family order by old.expires_at desc offset 4
     );
  loop
    v_code := public.jk_random_digits(6);
    exit when not exists (select 1 from public.pairing_codes pc where pc.code = v_code);
  end loop;
  insert into public.pairing_codes (code, family_id, child_ids, created_by, expires_at)
  values (v_code, v_family, (select array_agg(distinct w.child_id) from unnest(p_child_ids) as w (child_id)), auth.uid(), v_expires);
  return query select v_code, v_expires;
end $$;

/*
 * Called by the Edge Function `pair-device` with the anonymous user of the child
 * device. Returns {ok, familyId, childIds} or {ok: false, error}. Errors are
 * returned (not raised) so failed attempts are recorded for rate limiting.
 *
 * Guessing a 6-digit code is limited per device (10 failures / 15 min) and
 * globally (300 failures / 10 min pauses all pairing), because anonymous accounts
 * are cheap. Pairing is rare, so calls are serialized to make the counts exact.
 */
create function public.jk_pair_device(p_user_id uuid, p_code text, p_platform text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pairing public.pairing_codes;
  v_user_failures int;
  v_global_failures int;
begin
  perform pg_advisory_xact_lock(hashtext('jk_pair_device'));
  if exists (select 1 from public.parents where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select count(*) filter (where auth_user_id = p_user_id and created_at > now() - interval '15 minutes'),
         count(*) filter (where created_at > now() - interval '10 minutes')
    into v_user_failures, v_global_failures
    from public.code_failures
   where kind = 'pairing' and created_at > now() - interval '15 minutes';
  if v_user_failures >= 10 or v_global_failures >= 300 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  delete from public.pairing_codes pc
   where pc.code = btrim(coalesce(p_code, '')) and pc.expires_at > now()
  returning * into v_pairing;
  if v_pairing.code is null then
    insert into public.code_failures (auth_user_id, kind) values (p_user_id, 'pairing');
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  insert into public.child_devices (family_id, auth_user_id, child_ids, platform, last_seen)
  values (v_pairing.family_id, p_user_id, v_pairing.child_ids, left(p_platform, 20), now())
  on conflict (auth_user_id) do update
     set family_id = excluded.family_id, child_ids = excluded.child_ids, platform = excluded.platform, last_seen = now();
  delete from public.code_failures where auth_user_id = p_user_id and kind = 'pairing';
  return jsonb_build_object('ok', true, 'familyId', v_pairing.family_id, 'childIds', to_jsonb(v_pairing.child_ids));
end $$;

-- Removing a device deletes its anonymous user, which revokes the device token.
create function public.jk_remove_device(p_device_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  delete from public.child_devices
   where id = p_device_id and family_id = public.jk_parent_family()
  returning auth_user_id into v_user;
  if v_user is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from auth.users where id = v_user and is_anonymous;
end $$;

create function public.jk_register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_parent_family uuid := public.jk_parent_family();
  v_device public.child_devices;
begin
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_parent_family is not null then
    insert into public.push_tokens (token, family_id, parent_id, platform)
    values (p_token, v_parent_family, auth.uid(), left(p_platform, 20))
    on conflict (token) do update
       set parent_id = excluded.parent_id, device_id = null, platform = excluded.platform, updated_at = now()
     where public.push_tokens.family_id = excluded.family_id;
    return;
  end if;
  select * into v_device from public.child_devices where auth_user_id = auth.uid();
  if v_device.id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, family_id, device_id, platform)
  values (p_token, v_device.family_id, v_device.id, left(p_platform, 20))
  on conflict (token) do update
     set device_id = excluded.device_id, parent_id = null, platform = excluded.platform, updated_at = now()
   where public.push_tokens.family_id = excluded.family_id;
end $$;

-- ---------------------------------------------------------------------------
-- AI cost control (spec 8, service role only)
-- ---------------------------------------------------------------------------

-- Atomically counts one AI call. False when the family or child limit is reached.
create function public.jk_ai_take(p_family_id uuid, p_child_id uuid, p_family_limit int, p_child_limit int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_calls int;
begin
  insert into public.ai_usage as u (family_id, day, calls) values (p_family_id, v_today, 1)
  on conflict (family_id, day) do update set calls = u.calls + 1
  returning calls into v_calls;
  if v_calls > p_family_limit then
    raise exception 'family_limit' using errcode = 'P0001';
  end if;
  if p_child_id is not null and p_child_limit is not null then
    insert into public.ai_child_usage as u (child_id, day, calls) values (p_child_id, v_today, 1)
    on conflict (child_id, day) do update set calls = u.calls + 1
    returning calls into v_calls;
    if v_calls > p_child_limit then
      raise exception 'child_limit' using errcode = 'P0001';
    end if;
  end if;
  return true;
exception
  when raise_exception then
    return false;
end $$;

-- RevenueCat may deliver events late or twice: only apply an event that is newer
-- than the last one applied for the family (service role only).
create function public.jk_plus_event_is_newer(p_family_id uuid, p_event_ms bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_rows int;
begin
  if not exists (select 1 from public.families where id = p_family_id) then
    return false;
  end if;
  insert into public.plus_events as e (family_id, last_event_ms) values (p_family_id, p_event_ms)
  on conflict (family_id) do update set last_event_ms = excluded.last_event_ms
   where e.last_event_ms < excluded.last_event_ms;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

-- Housekeeping, run by the weekly-rollup job.
create function public.jk_cleanup() returns void
language sql security definer set search_path = '' as $$
  delete from public.pairing_codes where expires_at < now();
  delete from public.code_failures where created_at < now() - interval '1 day';
  delete from public.parent_invites where expires_at < now() - interval '30 days';
  delete from public.applied_commands where created_at < now() - interval '30 days';
  delete from public.ai_usage where day < current_date - 60;
  delete from public.ai_child_usage where day < current_date - 60;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;
-- Defence in depth: there are no write policies, and clients get no write grants either.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

grant execute on function
  public.jk_my_snapshot(),
  public.jk_create_family(text, text),
  public.jk_create_invite(),
  public.jk_accept_invite(text, text),
  public.jk_create_pairing_code(uuid[]),
  public.jk_remove_device(uuid),
  public.jk_register_push_token(text, text)
to authenticated;

-- Used inside RLS policies, so the calling role needs them.
grant execute on function
  public.jk_parent_family(),
  public.jk_device_family(),
  public.jk_device_children(),
  public.jk_is_anonymous()
to authenticated;

grant execute on all functions in schema public to service_role;

-- Objects created by later migrations start closed too: no client EXECUTE or table
-- writes unless a migration grants them explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
