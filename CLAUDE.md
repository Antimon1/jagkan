@AGENTS.md

# JagKan! – project notes

The product spec is `docs/JagKan_spec.md` (Swedish); backend setup is `docs/backend.md`.
The owner usually works from a phone and writes in Swedish: answer in Swedish.

## Rules that are easy to break

- `src/domain` and `src/backend` are pure TypeScript (no react, expo or npm imports):
  they also run in the Supabase Edge Functions. After changing them, run
  `npm run sync:shared`; CI fails if `supabase/functions/_shared` is stale.
- Every UI text lives in `src/lib/i18n/sv.ts`. Use i18next plurals (`key_one` /
  `key_other`) for counts. Texts shown to the child never mention losing or failing
  (tested in `tests/i18n.test.ts`).
- Photos and videos never leave the device (spec 12): no media columns, no uploads.
- No AI (spec 8) and no data about the children outside the EU: push messages stay
  neutral, without names, challenge titles or rewards (`src/backend/pushMessages.ts`).
- Child buttons are at least 64 pt and every child text has a `SpeakButton`.
- Database columns mirror the domain types (`src/domain/rows.ts`). Schema changes are
  new migrations; `npm run test:db` round-trips engine state through the database.
- Every new SQL function starts callable by everyone (PUBLIC): revoke it from public,
  anon and authenticated, then grant what is needed.
- The beta only has Äggdalen: `FULL_GAME_ENABLED` in `src/domain/launch.ts`. Tests that
  need the other worlds, slots or specials use `new Driver().fullGame()`.
- Seed changes: edit `seed/*.json`, then `npm run seed:sql -- --new` and `npm run sync:shared`.

## Before you commit

Run `npm run verify` (typecheck, lint, generated files, Jest, database tests).
Edge Function types: `deno check supabase/functions/*/index.ts` (runs in CI).
