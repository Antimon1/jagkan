import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { commitCommand } from '../functions/_shared/backend/commit.ts';
import { catalog } from '../functions/_shared/catalog.ts';
import { DEFAULT_SETTINGS } from '../functions/_shared/domain/constants.ts';
import { snapshotToState } from '../functions/_shared/domain/rows.ts';

import { asService, asUser, createDb, createUser, errorOf, pgliteStore } from './helpers.mjs';

const freeTemplate = catalog.templates.find((t) => !t.isPlus && t.ageMax <= 6).id;

/** A family built through the real engine and stored through jk_apply_diff. */
async function seedFamily(db) {
  const parent = await createUser(db);
  const { rows } = await asUser(db, parent, 'select public.jk_create_family($1, $2) as id', ['Familjen Test', 'Mamma']);
  const familyId = rows[0].id;
  const store = pgliteStore(db);
  const run = async (command, actor = { kind: 'parent', parentId: parent.id }, commandId = crypto.randomUUID()) => {
    const result = await commitCommand(store, {
      familyId,
      command,
      actor,
      commandId,
      catalog,
      now: () => new Date().toISOString(),
      newId: () => crypto.randomUUID(),
    });
    assert.ok(result.ok, `${command.type}: ${result.error}`);
    return result;
  };
  await run({ type: 'setPlus', active: true }, { kind: 'system' }, null);
  await run({ type: 'addChild', firstName: 'Evelyn', birthYear: 2021, birthMonth: 3 });
  const withChildren = await run({ type: 'addChild', firstName: 'Rafael', birthYear: 2019, birthMonth: 8 });
  const [evelyn, rafael] = withChildren.state.children.map((c) => c.id);
  const challengeId = (await run({ type: 'activateTemplate', childId: evelyn, templateId: freeTemplate })).state.challenges[0].id;
  const evelynDevice = { kind: 'child', childIds: [evelyn] };
  await run({ type: 'recordAttempt', challengeId }, evelynDevice);
  await run({ type: 'requestCompletion', challengeId }, evelynDevice);
  await run({ type: 'approveCompletion', challengeId, note: 'Så stolt!' });
  await run({ type: 'createReward', title: 'Glass', icon: '🍦', costStars: 1, childId: null });
  await run({ type: 'addCustomChallenge', childId: rafael, title: 'Bädda sängen', branch: 'hem', icon: '🛏️' });
  await run({ type: 'setFamilyGoal', title: 'Bio', targetStars: 10, rewardText: 'Popcorn' });
  const last = await run({ type: 'updateCompetitions', siblingDuelEnabled: true, handicaps: { [evelyn]: 1.5 } });
  return { parent, familyId, evelyn, rafael, store, run, state: last.state };
}

describe('JagKan! database', () => {
  let db;
  let family;

  before(async () => {
    db = await createDb();
    family = await seedFamily(db);
  });

  test('loads the catalog', async () => {
    const { rows } = await db.query(`select
      (select count(*)::int from public.challenge_templates) as templates,
      (select count(*)::int from public.creatures) as creatures,
      (select count(*)::int from public.milestones) as milestones`);
    assert.deepEqual(rows[0], { templates: catalog.templates.length, creatures: catalog.species.length * 3 + catalog.specials.length, milestones: catalog.milestones.length });
    const praise = await db.query(`select array_agg(id order by id) as ids from public.challenge_templates where reward = 'praise'`);
    assert.deepEqual(praise.rows[0].ids, catalog.templates.filter((t) => t.reward === 'praise').map((t) => t.id).sort());
  });

  test('default settings match the engine', async () => {
    const { rows } = await db.query('select public.jk_default_settings() as s');
    assert.deepEqual(rows[0].s, DEFAULT_SETTINGS);
  });

  test('stores engine state without losing a field or changing order', async () => {
    const reloaded = snapshotToState(await family.store.loadSnapshot(family.familyId));
    assert.deepStrictEqual(reloaded, family.state);
    assert.equal(reloaded.completions[0].parentNote, 'Så stolt!');
    assert.ok(reloaded.celebrations.length > 0);
  });

  test('a parent can only create one family, and devices cannot create any', async () => {
    assert.match(await errorOf(asUser(db, family.parent, 'select public.jk_create_family($1, $2)', ['Igen', 'Mamma'])), /already_in_family/);
    const device = await createUser(db, { anonymous: true });
    assert.match(await errorOf(asUser(db, device, 'select public.jk_create_family($1, $2)', ['X', 'Y'])), /not_authenticated/);
    const stranger = await createUser(db);
    assert.match(await errorOf(asUser(db, stranger, 'select public.jk_create_family($1, $2)', ['   ', 'Y'])), /invalid_input/);
  });

  test('parents see their own family and nothing of other families', async () => {
    const other = await createUser(db);
    await asUser(db, other, 'select public.jk_create_family($1, $2)', ['Grannarna', 'Pappa']);
    const mine = await asUser(db, family.parent, 'select count(*)::int as n from public.child_challenges');
    const theirs = await asUser(db, other, 'select count(*)::int as n from public.child_challenges');
    assert.equal(mine.rows[0].n, 2);
    assert.equal(theirs.rows[0].n, 0);
    const snap = await asUser(db, other, 'select public.jk_my_snapshot() as s');
    assert.equal(snap.rows[0].s.children.length, 0);
  });

  test('clients cannot write tables directly', async () => {
    assert.match(
      await errorOf(asUser(db, family.parent, 'update public.families set plus_active = true where id = $1', [family.familyId])),
      /permission denied/,
    );
    assert.match(await errorOf(asUser(db, family.parent, 'select public.jk_apply_diff($1, 0, null, $2::jsonb)', [family.familyId, '{}'])), /permission denied/);
  });

  describe('child devices', () => {
    let device;

    before(async () => {
      device = await createUser(db, { anonymous: true });
      const { rows } = await asUser(db, family.parent, 'select * from public.jk_create_pairing_code($1::uuid[])', [[family.evelyn]]);
      const paired = await asService(db, 'select public.jk_pair_device($1, $2, null, $3) as r', [device.id, rows[0].code, 'ios']);
      assert.deepEqual(paired.rows[0].r, { ok: true, familyId: family.familyId, childIds: [family.evelyn] });
      const reuse = await asService(db, 'select public.jk_pair_device($1, $2, null, $3) as r', [device.id, rows[0].code, 'ios']);
      assert.equal(reuse.rows[0].r.error, 'invalid_code');
    });

    test('see their own children, the shared family data and no parents', async () => {
      const challenges = await asUser(db, device, 'select child_id from public.child_challenges');
      assert.deepEqual(challenges.rows.map((r) => r.child_id), [family.evelyn]);
      for (const table of ['parents', 'child_devices']) {
        const { rows } = await asUser(db, device, `select count(*)::int as n from public.${table}`);
        assert.equal(rows[0].n, 0, table);
      }
      const shared = await asUser(db, device, 'select (select count(*)::int from public.rewards) as rewards, (select count(*)::int from public.children) as children');
      assert.deepEqual(shared.rows[0], { rewards: 1, children: 2 });
    });

    test('get a filtered snapshot and update last_seen', async () => {
      const { rows } = await asUser(db, device, 'select public.jk_my_snapshot() as s');
      const snap = rows[0].s;
      assert.equal(snap.parents.length, 0);
      assert.ok(snap.challenges.every((c) => c.child_id === family.evelyn));
      assert.ok(snap.ledger.length > 0);
      const seen = await asService(db, 'select last_seen from public.child_devices where auth_user_id = $1', [device.id]);
      assert.ok(seen.rows[0].last_seen);
    });

    test('pairing codes only cover the parent\'s own children and are rate limited', async () => {
      const other = await createUser(db);
      const { rows } = await asUser(db, other, 'select public.jk_create_family($1, $2) as id', ['Andra', 'Far']);
      assert.ok(rows[0].id);
      assert.match(await errorOf(asUser(db, other, 'select * from public.jk_create_pairing_code($1::uuid[])', [[family.evelyn]])), /invalid_input/);

      const guesser = await createUser(db, { anonymous: true });
      let last;
      for (let i = 0; i < 11; i += 1) {
        last = (await asService(db, 'select public.jk_pair_device($1, $2, null, $3) as r', [guesser.id, '000000', 'web'])).rows[0].r;
      }
      assert.equal(last.error, 'rate_limited');
      const parentTry = await asService(db, 'select public.jk_pair_device($1, $2, null, $3) as r', [family.parent.id, '123456', 'web']);
      assert.equal(parentTry.rows[0].r.error, 'forbidden');
    });

    test('push tokens are validated and bound to the device', async () => {
      await asUser(db, device, 'select public.jk_register_push_token($1, $2)', ['ExponentPushToken[abc123]', 'ios']);
      const { rows } = await asService(db, 'select family_id, device_id is not null as is_device from public.push_tokens');
      assert.deepEqual(rows, [{ family_id: family.familyId, is_device: true }]);
      assert.match(await errorOf(asUser(db, device, 'select public.jk_register_push_token($1, $2)', ['hej', 'ios'])), /invalid_input/);
    });

    test('pair with the QR token, which works even while manual entry is paused', async () => {
      const { rows } = await asUser(db, family.parent, 'select * from public.jk_create_pairing_code($1::uuid[])', [[family.rafael]]);
      assert.match(rows[0].token, /^[A-Z2-9]{32}$/);
      await asService(db, `insert into public.code_failures (auth_user_id, kind) select gen_random_uuid(), 'pairing' from generate_series(1, 300)`);
      const tablet = await createUser(db, { anonymous: true });
      const byCode = await asService(db, 'select public.jk_pair_device($1, $2, null, $3) as r', [tablet.id, rows[0].code, 'ios']);
      assert.equal(byCode.rows[0].r.error, 'rate_limited');
      const byToken = await asService(db, 'select public.jk_pair_device($1, null, $2, $3) as r', [tablet.id, rows[0].token, 'ios']);
      assert.deepEqual(byToken.rows[0].r, { ok: true, familyId: family.familyId, childIds: [family.rafael] });
      const wrong = await asService(db, 'select public.jk_pair_device($1, null, $2, $3) as r', [tablet.id, 'A'.repeat(32), 'ios']);
      assert.equal(wrong.rows[0].r.error, 'invalid_code');
      await asService(db, `delete from public.code_failures`);
    });

    test('removing a device revokes it', async () => {
      const { rows } = await asService(db, 'select id from public.child_devices where auth_user_id = $1', [device.id]);
      await asUser(db, family.parent, 'select public.jk_remove_device($1)', [rows[0].id]);
      const gone = await db.query('select count(*)::int as n from auth.users where id = $1', [device.id]);
      assert.equal(gone.rows[0].n, 0);
      const snap = await asUser(db, device, 'select public.jk_my_snapshot() as s');
      assert.equal(snap.rows[0].s, null);
    });
  });

  describe('jk_apply_diff', () => {
    const emptyDiff = (revision) => ({ family: null, competitions: null, upserts: [], deletes: [], revision });

    test('reports duplicates and stale revisions', async () => {
      const commandId = crypto.randomUUID();
      const { revision } = (await family.store.loadSnapshot(family.familyId)).family;
      assert.equal(await family.store.applyDiff({ familyId: family.familyId, expectedRevision: revision, commandId, diff: emptyDiff() }), 'applied');
      assert.equal(await family.store.applyDiff({ familyId: family.familyId, expectedRevision: revision, commandId, diff: emptyDiff() }), 'duplicate');
      const staleId = crypto.randomUUID();
      assert.equal(await family.store.applyDiff({ familyId: family.familyId, expectedRevision: revision - 1, commandId: staleId, diff: emptyDiff() }), 'conflict');
      assert.equal(await family.store.wasApplied(family.familyId, staleId), false);
    });

    test('refuses rows of another family and tables outside the game state', async () => {
      const { revision } = (await family.store.loadSnapshot(family.familyId)).family;
      const foreign = { ...emptyDiff(), upserts: [{ table: 'rewards', rows: [{ id: crypto.randomUUID(), family_id: crypto.randomUUID() }] }] };
      assert.match(await errorOf(family.store.applyDiff({ familyId: family.familyId, expectedRevision: revision, commandId: null, diff: foreign })), /row outside family/);
      const parents = { ...emptyDiff(), upserts: [{ table: 'parents', rows: [] }] };
      assert.match(await errorOf(family.store.applyDiff({ familyId: family.familyId, expectedRevision: revision, commandId: null, diff: parents })), /not writable/);
    });

    test('deletes rows when the engine removes them', async () => {
      await family.run({ type: 'removeChild', childId: family.rafael });
      const { rows } = await asService(db, 'select count(*)::int as n from public.child_challenges where child_id = $1', [family.rafael]);
      assert.equal(rows[0].n, 0);
    });
  });

  describe('co-parent invites', () => {
    test('the admin invites, a new parent joins once, co-parents cannot invite', async () => {
      const { rows } = await asUser(db, family.parent, 'select * from public.jk_create_invite()');
      const code = rows[0].code;
      assert.match(code, /^[A-Z2-9]{8}$/);
      const coparent = await createUser(db);
      const joined = await asUser(db, coparent, 'select public.jk_accept_invite($1, $2) as id', [code.toLowerCase(), 'Pappa']);
      assert.equal(joined.rows[0].id, family.familyId);
      const late = await createUser(db);
      const reused = await asUser(db, late, 'select public.jk_accept_invite($1, $2) as id', [code, 'Moster']);
      assert.equal(reused.rows[0].id, null);
      assert.match(await errorOf(asUser(db, coparent, 'select * from public.jk_create_invite()')), /forbidden/);
    });
  });

  describe('roles', () => {
    let coparent;

    before(async () => {
      const { rows } = await asUser(db, family.parent, 'select * from public.jk_create_invite()');
      coparent = await createUser(db);
      await asUser(db, coparent, 'select public.jk_accept_invite($1, $2)', [rows[0].code, 'Bonuspappa']);
    });

    test('a co-parent cannot remove devices or other parents', async () => {
      const tablet = await createUser(db, { anonymous: true });
      const { rows } = await asUser(db, family.parent, 'select * from public.jk_create_pairing_code($1::uuid[])', [[family.evelyn]]);
      await asService(db, 'select public.jk_pair_device($1, $2, null, $3)', [tablet.id, rows[0].code, 'ios']);
      const device = await asService(db, 'select id from public.child_devices where auth_user_id = $1', [tablet.id]);
      assert.match(await errorOf(asUser(db, coparent, 'select public.jk_remove_device($1)', [device.rows[0].id])), /forbidden/);
      assert.match(await errorOf(asUser(db, coparent, 'select public.jk_remove_coparent($1)', [family.parent.id])), /forbidden/);
    });

    test('the admin removes a co-parent, which deletes the account and its access', async () => {
      const before = (await asService(db, 'select revision from public.families where id = $1', [family.familyId])).rows[0].revision;
      assert.match(await errorOf(asUser(db, family.parent, 'select public.jk_remove_coparent($1)', [family.parent.id])), /not_found/);
      await asUser(db, family.parent, 'select public.jk_remove_coparent($1)', [coparent.id]);

      const left = await db.query('select (select count(*)::int from public.parents where id = $1) as parents, (select count(*)::int from auth.users where id = $1) as users', [coparent.id]);
      assert.deepEqual(left.rows[0], { parents: 0, users: 0 });
      const after = (await asService(db, 'select revision from public.families where id = $1', [family.familyId])).rows[0].revision;
      assert.ok(Number(after) > Number(before));
      const snap = await asUser(db, coparent, 'select public.jk_my_snapshot() as s');
      assert.equal(snap.rows[0].s, null);
    });
  });

  describe('owner statistics', () => {
    test('weekly totals without names, for the service role only', async () => {
      const { rows } = await asService(db, 'select * from public.jk_beta_stats(2)');
      assert.equal(rows.length, 2);
      assert.deepEqual(Object.keys(rows[0]), ['week_start', 'families', 'active_families', 'paired_devices', 'attempts', 'approvals', 'hatched']);
      const thisWeek = rows[1];
      assert.ok(thisWeek.families >= 1 && thisWeek.active_families >= 1);
      assert.ok(thisWeek.attempts >= 1 && thisWeek.approvals >= 1 && thisWeek.hatched >= 1);
      assert.match(await errorOf(asUser(db, family.parent, 'select * from public.jk_beta_stats()')), /permission denied/);
    });

    test('clients cannot call the service-only functions created after the first migrations', async () => {
      const device = await createUser(db, { anonymous: true });
      for (const sql of [
        'select public.jk_pair_device($1, null, null, null)',
        'select public.jk_beta_stats(1) where $1::uuid is not null',
      ]) {
        assert.match(await errorOf(asUser(db, family.parent, sql, [device.id])), /permission denied/, sql);
        assert.match(await errorOf(asUser(db, device, sql, [device.id])), /permission denied/, sql);
      }
    });
  });

  describe('hardening', () => {
    test('invite guessing is limited per account', async () => {
      const guesser = await createUser(db);
      for (let i = 0; i < 10; i += 1) {
        const { rows } = await asUser(db, guesser, 'select public.jk_accept_invite($1, $2) as id', ['AAAAAAAA', 'X']);
        assert.equal(rows[0].id, null);
      }
      assert.match(await errorOf(asUser(db, guesser, 'select public.jk_accept_invite($1, $2)', ['AAAAAAAA', 'X'])), /rate_limited/);
    });

    test('a family has at most five live pairing codes', async () => {
      const parent = await createUser(db);
      const { rows } = await asUser(db, parent, 'select public.jk_create_family($1, $2) as id', ['Koder', 'Mor']);
      const familyId = rows[0].id;
      const childId = crypto.randomUUID();
      await asService(
        db,
        'insert into public.children (id, family_id, first_name, birth_year, birth_month, world, created_at) values ($1, $2, $3, 2020, 1, $4, now())',
        [childId, familyId, 'Ida', 'valley'],
      );
      for (let i = 0; i < 7; i += 1) {
        await asUser(db, parent, 'select * from public.jk_create_pairing_code($1::uuid[])', [[childId]]);
      }
      const live = await asService(db, 'select count(*)::int as n from public.pairing_codes where family_id = $1', [familyId]);
      assert.equal(live.rows[0].n, 5);
    });

    test('many failed guesses from many devices pause manual code entry', async () => {
      await asService(db, `insert into public.code_failures (auth_user_id, kind) select gen_random_uuid(), 'pairing' from generate_series(1, 300)`);
      const device = await createUser(db, { anonymous: true });
      const { rows } = await asService(db, 'select public.jk_pair_device($1, $2, null, $3) as r', [device.id, '123456', 'web']);
      assert.equal(rows[0].r.error, 'rate_limited');
      await asService(db, `delete from public.code_failures where kind = 'pairing'`);
    });

    test('command ids are scoped to the family', async () => {
      const other = await createUser(db);
      const { rows } = await asUser(db, other, 'select public.jk_create_family($1, $2) as id', ['Scope', 'Far']);
      const commandId = crypto.randomUUID();
      const store = pgliteStore(db);
      const mine = (await store.loadSnapshot(family.familyId)).family.revision;
      const theirs = (await store.loadSnapshot(rows[0].id)).family.revision;
      const empty = { family: null, competitions: null, upserts: [], deletes: [] };
      assert.equal(await store.applyDiff({ familyId: family.familyId, expectedRevision: mine, commandId, diff: empty }), 'applied');
      assert.equal(await store.applyDiff({ familyId: rows[0].id, expectedRevision: theirs, commandId, diff: empty }), 'applied');
    });

    test('RevenueCat events only apply when newer', async () => {
      const newer = async (familyId, ms) =>
        (await asService(db, 'select public.jk_plus_event_is_newer($1, $2) as ok', [familyId, ms])).rows[0].ok;
      assert.equal(await newer(family.familyId, 2000), true);
      assert.equal(await newer(family.familyId, 1000), false);
      assert.equal(await newer(family.familyId, 2000), false);
      assert.equal(await newer(family.familyId, 3000), true);
      assert.equal(await newer(crypto.randomUUID(), 1000), false);
    });

    test('a push token cannot be moved to another family', async () => {
      const token = 'ExponentPushToken[shared]';
      await asUser(db, family.parent, 'select public.jk_register_push_token($1, $2)', [token, 'ios']);
      const intruder = await createUser(db);
      await asUser(db, intruder, 'select public.jk_create_family($1, $2)', ['Inkräktare', 'X']);
      await asUser(db, intruder, 'select public.jk_register_push_token($1, $2)', [token, 'ios']);
      const { rows } = await asService(db, 'select family_id from public.push_tokens where token = $1', [token]);
      assert.equal(rows[0].family_id, family.familyId);
    });
  });

  test('AI tables and functions are gone', async () => {
    const { rows } = await db.query(`select
      (select count(*)::int from pg_tables
        where schemaname = 'public' and tablename in ('ai_suggestions', 'ai_usage', 'ai_child_usage')) as tables,
      (select count(*)::int from pg_proc where proname = 'jk_ai_take') as functions`);
    assert.deepEqual(rows[0], { tables: 0, functions: 0 });
  });
});
