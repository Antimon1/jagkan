-- Measurement and security from docs/idepanel-helhetsanalys.md (stage 5):
--   1. Roles: only the admin removes devices and co-parents (the engine keeps
--      removeChild admin-only, src/domain/commands.ts ADMIN_COMMANDS).
--   2. Pairing: the QR code carries a long secret token that cannot be guessed, so
--      it always works. The global brake on failed guesses only pauses manual
--      entry of the six-digit code.
--   3. Statistics for the owner: weekly totals, never names (service role only).

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------

-- The caller's family when the caller is its admin, else null.
create function public.jk_admin_family() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.parents where id = auth.uid() and role = 'admin'
$$;

create or replace function public.jk_remove_device(p_device_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid := public.jk_admin_family();
  v_user uuid;
begin
  if v_family is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.child_devices
   where id = p_device_id and family_id = v_family
  returning auth_user_id into v_user;
  if v_user is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from auth.users where id = v_user and is_anonymous;
end $$;

/*
 * Removes a co-parent from the family: deletes the account, which cascades to the
 * parents row and the push tokens and revokes every session. Completions the
 * co-parent approved stay (approved_by is not a foreign key).
 */
create function public.jk_remove_coparent(p_parent_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid := public.jk_admin_family();
begin
  if v_family is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.parents where id = p_parent_id and family_id = v_family and role = 'coparent'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from auth.users where id = p_parent_id;
  update public.families set revision = revision + 1 where id = v_family;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Pairing with a QR token
-- ---------------------------------------------------------------------------

-- Live codes are at most 10 minutes old; they are simply issued again.
delete from public.pairing_codes;
alter table public.pairing_codes add column token text not null check (token ~ '^[A-Z2-9]{32}$');
create unique index pairing_codes_token_idx on public.pairing_codes (token);

alter table public.code_failures drop constraint code_failures_kind_check;
alter table public.code_failures add constraint code_failures_kind_check
  check (kind in ('pairing', 'pairing_token', 'invite'));

drop function public.jk_create_pairing_code(uuid[]);
drop function public.jk_pair_device(uuid, text, text);

-- Six digits to type and a 32-character token (160 bits) for the QR code, both
-- valid 10 minutes, for the given children of the caller's family.
create function public.jk_create_pairing_code(p_child_ids uuid[])
returns table (code text, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_family uuid := public.jk_parent_family();
  v_code text;
  v_token text := public.jk_random_code(32);
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
  insert into public.pairing_codes (code, token, family_id, child_ids, created_by, expires_at)
  values (
    v_code, v_token, v_family,
    (select array_agg(distinct w.child_id) from unnest(p_child_ids) as w (child_id)), auth.uid(), v_expires
  );
  return query select v_code, v_token, v_expires;
end $$;

/*
 * Called by the Edge Function `pair-device` with the anonymous user of the child
 * device and either the six-digit code or the QR token. Returns {ok, familyId,
 * childIds} or {ok: false, error}. Errors are returned (not raised) so failed
 * attempts are recorded for rate limiting.
 *
 * - Every device: 10 failures per 15 minutes.
 * - Manual codes: 300 failed guesses per 10 minutes across all devices pause manual
 *   entry, because anonymous accounts are cheap. The QR token cannot be guessed, so
 *   it is never paused: a family can always pair by scanning.
 */
create function public.jk_pair_device(p_user_id uuid, p_code text, p_token text, p_platform text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_by_token boolean := p_token is not null;
  v_pairing public.pairing_codes;
  v_user_failures int;
  v_code_failures int;
begin
  perform pg_advisory_xact_lock(hashtext('jk_pair_device'));
  if exists (select 1 from public.parents where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select count(*) filter (where auth_user_id = p_user_id),
         count(*) filter (where kind = 'pairing' and created_at > now() - interval '10 minutes')
    into v_user_failures, v_code_failures
    from public.code_failures
   where kind in ('pairing', 'pairing_token') and created_at > now() - interval '15 minutes';
  if v_user_failures >= 10 or (not v_by_token and v_code_failures >= 300) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_by_token then
    delete from public.pairing_codes pc
     where pc.token = p_token and pc.expires_at > now()
    returning * into v_pairing;
  else
    delete from public.pairing_codes pc
     where pc.code = btrim(coalesce(p_code, '')) and pc.expires_at > now()
    returning * into v_pairing;
  end if;
  if v_pairing.code is null then
    insert into public.code_failures (auth_user_id, kind)
    values (p_user_id, case when v_by_token then 'pairing_token' else 'pairing' end);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  insert into public.child_devices (family_id, auth_user_id, child_ids, platform, last_seen)
  values (v_pairing.family_id, p_user_id, v_pairing.child_ids, left(p_platform, 20), now())
  on conflict (auth_user_id) do update
     set family_id = excluded.family_id, child_ids = excluded.child_ids, platform = excluded.platform, last_seen = now();
  delete from public.code_failures where auth_user_id = p_user_id and kind in ('pairing', 'pairing_token');
  return jsonb_build_object('ok', true, 'familyId', v_pairing.family_id, 'childIds', to_jsonb(v_pairing.child_ids));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Statistics for the owner (run in the SQL editor: select * from public.jk_beta_stats();)
-- ---------------------------------------------------------------------------

/*
 * Weekly totals (Monday to Sunday, Stockholm time) for the beta questions in
 * docs/idepanel-helhetsanalys.md: how many families are active, do parents still
 * approve, and is the collection growing. Only counts, never names or ids.
 */
create function public.jk_beta_stats(p_weeks int default 8)
returns table (
  week_start date,
  families int,
  active_families int,
  paired_devices int,
  attempts int,
  approvals int,
  hatched int
)
language sql stable security definer set search_path = '' as $$
  with weeks as (
    select (date_trunc('week', now() at time zone 'Europe/Stockholm') - make_interval(weeks => g))::date as week_start
      from generate_series(0, least(greatest(p_weeks, 1), 104) - 1) as g
  ),
  activity as (
    select a.family_id, (a.created_at at time zone 'Europe/Stockholm')::date as day, 'attempt' as kind
      from public.attempts a
     where a.source = 'child'
    union all
    select c.family_id, (c.approved_at at time zone 'Europe/Stockholm')::date, 'approval'
      from public.completions c
  )
  select
    w.week_start,
    (select count(*)::int from public.families f
      where (f.created_at at time zone 'Europe/Stockholm')::date <= w.week_start + 6),
    (select count(distinct x.family_id)::int from activity x where x.day between w.week_start and w.week_start + 6),
    (select count(*)::int from public.child_devices d
      where (d.created_at at time zone 'Europe/Stockholm')::date between w.week_start and w.week_start + 6),
    (select count(*)::int from activity x where x.kind = 'attempt' and x.day between w.week_start and w.week_start + 6),
    (select count(*)::int from activity x where x.kind = 'approval' and x.day between w.week_start and w.week_start + 6),
    (select count(*)::int from public.child_creatures cc
      where not cc.is_special
        and (cc.unlocked_at at time zone 'Europe/Stockholm')::date between w.week_start and w.week_start + 6)
  from weeks w
  order by w.week_start
$$;

-- ---------------------------------------------------------------------------
-- Grants. Postgres gives PUBLIC execute on every new function, and a per-schema
-- default privilege cannot take that away, so close each new function explicitly.
-- ---------------------------------------------------------------------------

revoke all on function
  public.jk_admin_family(),
  public.jk_remove_coparent(uuid),
  public.jk_create_pairing_code(uuid[]),
  public.jk_pair_device(uuid, text, text, text),
  public.jk_beta_stats(int)
from public, anon, authenticated;

grant execute on function
  public.jk_remove_coparent(uuid),
  public.jk_create_pairing_code(uuid[])
to authenticated;

grant execute on function
  public.jk_admin_family(),
  public.jk_remove_coparent(uuid),
  public.jk_create_pairing_code(uuid[]),
  public.jk_pair_device(uuid, text, text, text),
  public.jk_beta_stats(int)
to service_role;
