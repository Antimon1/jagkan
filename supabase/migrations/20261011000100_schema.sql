-- JagKan! schema (spec 14.1). Run in an EU-region Supabase project.
--
-- Family tables mirror the domain types in src/domain/types.ts column for column
-- (camelCase -> snake_case, see src/domain/rows.ts): the Edge Functions run the
-- game engine and write the resulting row diffs with jk_apply_diff().
-- `seq` is storage-only: it keeps insertion order, which the engine relies on
-- (e.g. the order of celebrations), and is stripped from snapshots.

-- ---------------------------------------------------------------------------
-- Catalog (static content from seed/*.json, loaded by the catalog migration)
-- ---------------------------------------------------------------------------

create table public.challenge_templates (
  id text primary key,
  branch text not null check (branch in ('kropp', 'mat', 'hem', 'ute', 'pengar', 'kanslor', 'mod')),
  age_min int not null check (age_min between 4 and 13),
  age_max int not null check (age_max between 4 and 13),
  difficulty int not null check (difficulty between 1 and 3),
  title_child text not null,
  title_parent text not null,
  icon text not null,
  parent_tip text not null,
  repeatable boolean not null,
  tags text[] not null default '{}',
  is_plus boolean not null,
  check (age_min <= age_max)
);

create table public.creatures (
  id text primary key,
  world text not null check (world in ('valley', 'dino', 'explorer')),
  branch text check (branch in ('kropp', 'mat', 'hem', 'ute', 'pengar', 'kanslor', 'mod')),
  family_slot int check (family_slot between 1 and 3),
  stage int check (stage between 1 and 3),
  name text not null,
  asset_key text not null,
  is_special boolean not null,
  unlock_rule jsonb
);

create table public.milestones (
  id text primary key,
  threshold_stars int not null check (threshold_stars > 0),
  title text not null,
  background_key text not null,
  emoji text not null
);

-- ---------------------------------------------------------------------------
-- Family data (synced between the parents' and the children's devices)
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  plus_active boolean not null default false,
  settings jsonb not null,
  revision bigint not null default 0
);

create table public.parents (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  role text not null check (role in ('admin', 'coparent')),
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index parents_family_idx on public.parents (family_id);

-- Children have no accounts and no e-mail (spec 11). Only first name and birth month (spec 12).
create table public.children (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  birth_year int not null check (birth_year between 2000 and 2100),
  birth_month int not null check (birth_month between 1 and 12),
  world text not null check (world in ('valley', 'dino', 'explorer')),
  avatar_creature_id text,
  graduation_snoozed_at timestamptz,
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index children_family_idx on public.children (family_id);

create table public.child_challenges (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  template_id text,
  custom_title text,
  custom_icon text,
  custom_tip text,
  branch text not null check (branch in ('kropp', 'mat', 'hem', 'ute', 'pengar', 'kanslor', 'mod')),
  status text not null check (status in ('suggested', 'active', 'requested', 'completed', 'paused', 'archived')),
  source text not null check (source in ('library', 'custom', 'ai')),
  repeatable boolean not null,
  sparks int not null default 0 check (sparks >= 0),
  last_spark_day date,
  repeat_count int not null default 0 check (repeat_count >= 0),
  created_at timestamptz not null,
  activated_at timestamptz,
  requested_at timestamptz,
  completed_at timestamptz,
  seq bigint generated always as identity
);
create index child_challenges_family_idx on public.child_challenges (family_id);
create index child_challenges_child_idx on public.child_challenges (child_id);

create table public.attempts (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  child_challenge_id uuid references public.child_challenges (id) on delete cascade,
  source text not null check (source in ('child', 'parent', 'duel')),
  day date not null,
  spark_awarded boolean not null,
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index attempts_family_idx on public.attempts (family_id);

-- No photo or media reference here: photos stay on the device (spec 12, local_media).
create table public.completions (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  child_challenge_id uuid not null references public.child_challenges (id) on delete cascade,
  approved_by uuid,
  approved_at timestamptz not null,
  parent_note text,
  card_text text not null,
  creature_id text,
  world text not null check (world in ('valley', 'dino', 'explorer')),
  branch text not null,
  is_first boolean not null,
  attempts_count int not null,
  seq bigint generated always as identity
);
create index completions_family_idx on public.completions (family_id);

create table public.child_creatures (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  creature_id text not null,
  world text not null check (world in ('valley', 'dino', 'explorer')),
  branch text,
  is_special boolean not null,
  stage int not null check (stage between 1 and 3),
  growth int not null default 0,
  unlocked_at timestamptz not null,
  seq bigint generated always as identity
);
create index child_creatures_family_idx on public.child_creatures (family_id);

create table public.child_milestones (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  milestone_id text not null,
  reached_at timestamptz not null,
  seq bigint generated always as identity
);
create index child_milestones_family_idx on public.child_milestones (family_id);

-- The star balance is the sum of delta (spec 14.1).
create table public.star_ledger (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('completion', 'spark_bonus', 'reward_redeem', 'adjust')),
  ref_id text,
  branch text,
  world text,
  note text,
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index star_ledger_family_idx on public.star_ledger (family_id);

create table public.rewards (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null,
  icon text not null,
  cost_stars int not null check (cost_stars > 0),
  child_id uuid references public.children (id) on delete cascade,
  active boolean not null,
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index rewards_family_idx on public.rewards (family_id);

create table public.reward_requests (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  cost_stars int not null,
  status text not null check (status in ('requested', 'confirmed', 'declined')),
  created_at timestamptz not null,
  resolved_at timestamptz,
  seq bigint generated always as identity
);
create index reward_requests_family_idx on public.reward_requests (family_id);

create table public.family_goals (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null,
  target_stars int not null check (target_stars > 0),
  reward_text text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  reached_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index family_goals_family_idx on public.family_goals (family_id);

create table public.competitions (
  family_id uuid primary key references public.families (id) on delete cascade,
  family_goal_enabled boolean not null default false,
  sibling_duel_enabled boolean not null default false,
  self_mode_enabled boolean not null default true,
  handicaps jsonb not null default '{}'
);

create table public.weekly_results (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  week_start date not null,
  duel boolean not null,
  results jsonb not null,
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index weekly_results_family_idx on public.weekly_results (family_id);

-- AI suggestions are only ever shown to parents (spec 8).
create table public.ai_suggestions (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  payload jsonb not null,
  status text not null check (status in ('new', 'accepted', 'dismissed')),
  created_at timestamptz not null,
  seq bigint generated always as identity
);
create index ai_suggestions_family_idx on public.ai_suggestions (family_id);

create table public.celebrations (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  seen_at timestamptz,
  seq bigint generated always as identity
);
create index celebrations_family_idx on public.celebrations (family_id);

-- ---------------------------------------------------------------------------
-- Devices, codes and server bookkeeping (never in snapshots)
-- ---------------------------------------------------------------------------

-- A child device signs in anonymously; pairing binds that session to children
-- (spec 11). The anonymous session is the device token: removing the device
-- deletes the anonymous user, which revokes it.
create table public.child_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  child_ids uuid[] not null check (cardinality(child_ids) > 0),
  platform text,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);
create index child_devices_family_idx on public.child_devices (family_id);

create table public.pairing_codes (
  code text primary key check (code ~ '^[0-9]{6}$'),
  family_id uuid not null references public.families (id) on delete cascade,
  child_ids uuid[] not null check (cardinality(child_ids) > 0),
  created_by uuid not null,
  expires_at timestamptz not null
);

-- Failed pairing / invite code attempts, for rate limiting.
create table public.code_failures (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null,
  kind text not null check (kind in ('pairing', 'invite')),
  created_at timestamptz not null default now()
);
create index code_failures_kind_idx on public.code_failures (kind, created_at);
create index code_failures_user_idx on public.code_failures (auth_user_id, created_at);

create table public.parent_invites (
  code text primary key check (code ~ '^[A-Z2-9]{8}$'),
  family_id uuid not null references public.families (id) on delete cascade,
  created_by uuid not null,
  expires_at timestamptz not null,
  used_by uuid,
  used_at timestamptz
);

create table public.push_tokens (
  token text primary key check (char_length(token) <= 200),
  family_id uuid not null references public.families (id) on delete cascade,
  parent_id uuid references public.parents (id) on delete cascade,
  device_id uuid references public.child_devices (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now(),
  check ((parent_id is null) <> (device_id is null))
);
create index push_tokens_family_idx on public.push_tokens (family_id);

-- Idempotency keys from the device outboxes (offline queue).
create table public.applied_commands (
  family_id uuid not null references public.families (id) on delete cascade,
  id uuid not null,
  created_at timestamptz not null default now(),
  primary key (family_id, id)
);
create index applied_commands_created_idx on public.applied_commands (created_at);

-- AI cost control (spec 8): calls per family and day, and per child and day ("Ge mig fler").
create table public.ai_usage (
  family_id uuid not null references public.families (id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (family_id, day)
);

-- Newest RevenueCat event applied per family (late or repeated events are ignored).
create table public.plus_events (
  family_id uuid primary key references public.families (id) on delete cascade,
  last_event_ms bigint not null
);

create table public.ai_child_usage (
  child_id uuid not null references public.children (id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (child_id, day)
);
