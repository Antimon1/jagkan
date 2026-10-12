/**
 * Test database: PGlite (real Postgres in WebAssembly) with a minimal stand-in for
 * the Supabase parts the migrations use (auth schema, roles, default grants), then
 * every migration in supabase/migrations, in order.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  -- Supabase grants table and function access by default; RLS and the migrations narrow it.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, is_anonymous boolean not null default false);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
`;

export async function createDb() {
  const db = await PGlite.create();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  return db;
}

let counter = 0;

/** A Supabase auth user: a parent (e-mail) or a child device (anonymous). */
export async function createUser(db, { anonymous = false } = {}) {
  counter += 1;
  const id = crypto.randomUUID();
  await db.query('insert into auth.users (id, email, is_anonymous) values ($1, $2, $3)', [
    id,
    anonymous ? null : `parent${counter}@example.com`,
    anonymous,
  ]);
  return { id, anonymous };
}

async function withRole(db, role, user, fn) {
  const claims = user ? JSON.stringify({ sub: user.id, role, is_anonymous: user.anonymous }) : '';
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [
    user?.id ?? '',
    claims,
  ]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
  }
}

/** Run a query as a signed-in user (role authenticated, RLS applies). */
export function asUser(db, user, sql, params = []) {
  return withRole(db, 'authenticated', user, () => db.query(sql, params));
}

/** Run a query as the Edge Functions do (service role, bypasses RLS). */
export function asService(db, sql, params = []) {
  return withRole(db, 'service_role', null, () => db.query(sql, params));
}

/** The FamilyStore the Edge Functions use (supabase/functions/_shared/store.ts), backed by PGlite. */
export function pgliteStore(db) {
  return {
    async loadSnapshot(familyId) {
      const { rows } = await asService(db, 'select public.jk_family_snapshot($1) as s', [familyId]);
      return rows[0].s;
    },
    async wasApplied(familyId, commandId) {
      const { rows } = await asService(
        db,
        'select exists (select 1 from public.applied_commands where family_id = $1 and id = $2) as e',
        [familyId, commandId],
      );
      return rows[0].e;
    },
    async applyDiff({ familyId, expectedRevision, commandId, diff }) {
      const { rows } = await asService(db, 'select public.jk_apply_diff($1, $2, $3, $4::jsonb) as r', [
        familyId,
        expectedRevision,
        commandId,
        JSON.stringify(diff),
      ]);
      return rows[0].r;
    },
  };
}

/** Postgres error message of a failing promise. */
export async function errorOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error.message;
  }
  throw new Error('expected an error');
}
