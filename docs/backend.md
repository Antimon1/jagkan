# Backend (Supabase)

The app works without a backend: in local mode everything lives on one device,
which is how the GitHub Pages preview runs. Cloud mode (sync between the
parents' and the children's devices) needs a Supabase project.

## How it fits together

```
App (Expo)                                Supabase (EU region)
──────────                                ────────────────────
command ──► outbox (offline queue) ──►    game-action ──► same engine (src/domain)
                                             │              └► jk_apply_diff (one transaction)
snapshot ◄─────────────────────────────── jk_family_snapshot (filtered for devices)
Realtime ◄─────────────────────────────── families, child_challenges, completions,
                                          reward_requests, family_goals
```

- **One engine.** `src/domain` is pure TypeScript. `npm run sync:shared` copies it,
  `src/backend` and the seed data to `supabase/functions/_shared`. CI fails if the
  copy is stale.
- **Writes** only go through Edge Functions (service role). Clients have read-only
  RLS policies and no table write grants.
- **Devices.** A child device signs in anonymously and trades a 6-digit pairing code
  for access to its children (`pair-device`). That anonymous session is the device
  token; removing the device deletes the user and revokes it.
- **Photos never leave the device.** No table has a photo or media column.
- **No data about the children leaves the EU.** There is no AI (removed 2026-10-12,
  see `docs/idepanel-helhetsanalys.md`). Push messages go through Expo, Apple and
  Google, so they are neutral: no names, challenge titles or rewards
  (`src/backend/pushMessages.ts`).

### Edge Functions and the spec (14.2)

| Spec | Implementation |
|---|---|
| `pair-device` | `pair-device` |
| `approve-completion` | `game-action` (command `approveCompletion`, one transaction) |
| `weekly-rollup` | `weekly-rollup` (cron) |
| `revenuecat-webhook` | `revenuecat-webhook` |
| Export / delete data (spec 12) | export happens in the app; `delete-family` erases the family |

## Set up a project

1. Create a project at [supabase.com](https://supabase.com) in an **EU region**
   (for example Frankfurt or Stockholm).
2. **Authentication → Providers:** enable *Email* and *Anonymous sign-ins*. Enable
   *Apple* for Sign in with Apple (iOS).
3. **Authentication → Email templates → Magic link:** include `{{ .Token }}` so the
   e-mail contains the 6-digit code the app asks for.
4. **Database:** apply the migrations, either with the *Deploy backend* GitHub
   workflow (below) or locally: `npx supabase link --project-ref <ref>` and
   `npx supabase db push`.
5. **Edge Functions → Secrets:**

   | Secret | What |
   |---|---|
   | `CRON_SECRET` | A long random string; the scheduled jobs send it. |
   | `REVENUECAT_WEBHOOK_SECRET` | Shared secret for the RevenueCat webhook. |
   | `EXPO_ACCESS_TOKEN` | Optional, if push security is enabled in Expo. |

6. **App config:** put the project URL and anon key in `.env.local`
   (see `.env.example`) or in the EAS build environment.

## Deploy from GitHub (works from the phone)

Add these repository secrets (*Settings → Secrets and variables → Actions*):
`SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access tokens),
`SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`. Then run
*Actions → Deploy backend → Run workflow*.

## Scheduled jobs

Enable the `pg_cron` and `pg_net` extensions, store the cron secret in Vault and
schedule the jobs in the SQL editor (replace `<ref>`). Times are UTC; the weekly
rollup must run after Sunday 19:00 Stockholm time.

```sql
select vault.create_secret('<the CRON_SECRET value>', 'jagkan_cron_secret');

create or replace function public.jk_call_function(p_name text) returns void
language sql security definer set search_path = public as $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jagkan_cron_secret')
    ),
    body := '{}'::jsonb
  );
$$;
revoke all on function public.jk_call_function(text) from public, anon, authenticated;

-- Sunday 19:30 (winter) / 20:30 (summer) Stockholm time.
select cron.schedule('jagkan-weekly-rollup', '30 18 * * 0', $$ select public.jk_call_function('weekly-rollup') $$);
-- Monday morning catch-up (the rollup is idempotent).
select cron.schedule('jagkan-weekly-rollup-catchup', '0 4 * * 1', $$ select public.jk_call_function('weekly-rollup') $$);
```

## Beta statistics

Run this in the SQL editor to follow the beta (docs/idepanel-helhetsanalys.md):
how many families are active each week, whether parents still approve, and
whether the collection grows. It returns weekly totals only, never names, and
only the service role (the SQL editor) can run it.

```sql
select * from public.jk_beta_stats(8);  -- the last 8 weeks
```

Parents see their own family's numbers in the app (Mer → Statistik), counted from
the family's data on the device. Nothing extra is tracked.

## Roles and pairing

- **Admin only:** removing a child (engine, `ADMIN_COMMANDS`), removing a device
  (`jk_remove_device`), inviting and removing co-parents (`jk_create_invite`,
  `jk_remove_coparent`), buying Plus (app) and deleting the family (`delete-family`).
  Removing a co-parent deletes the account, which ends all of its sessions.
- **Pairing:** the QR code carries a 32-character token that cannot be guessed and is
  never rate limited. The six-digit code is limited to 10 failures per device and
  15 minutes; 300 failed guesses within 10 minutes pause manual entry for everyone.

## RevenueCat

Webhook URL: `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`,
authorization header value `Bearer <REVENUECAT_WEBHOOK_SECRET>`. The app uses the
family id as RevenueCat app user id and the entitlement `plus`.

## Tests

- `npm test`: engine and server logic (Jest).
- `npm run test:db`: every migration in PGlite (Postgres in WebAssembly) with a
  stand-in for Supabase auth: RLS, pairing, invites, roles, statistics, and a full
  engine → `jk_apply_diff` → snapshot round trip.
- `deno check supabase/functions/*/index.ts`: Edge Function types (CI).

## Changing things

- Engine or server logic: edit `src/domain` / `src/backend`, then `npm run sync:shared`.
- Seed data: edit `seed/*.json`, then `npm run seed:sql -- --new` to add a new catalog
  migration (never edit an applied migration), and `npm run sync:shared`.
- Schema: add a new migration file; keep columns in step with `src/domain/types.ts`
  (the round-trip test catches mismatches). Postgres gives PUBLIC execute on every
  new function, so each new function needs `revoke all ... from public, anon,
  authenticated` and explicit grants (see `20261012160000_roles_pairing_stats.sql`).
