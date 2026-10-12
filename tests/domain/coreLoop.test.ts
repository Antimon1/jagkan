import { totalStars, spendableStars } from '@/domain/stars';
import { Driver, freeTemplate, plusTemplate, SYSTEM } from '../helpers';

describe('core loop: spark → request → approve → star → hatch', () => {
  it('adds a child in the world that fits the age', () => {
    const d = new Driver();
    const evelyn = d.addChild('Evelyn', 2020, 3);
    const child = d.state.children.find((c) => c.id === evelyn);
    expect(child?.world).toBe('valley');
    expect(child?.firstName).toBe('Evelyn');
  });

  it('puts a 8-year-old in Dinodalen and a 11-year-old in Utforskarbasen', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    const a = d.addChild('Alva', 2018, 5);
    const b = d.addChild('Bo', 2015, 1);
    expect(d.state.children.find((c) => c.id === a)?.world).toBe('dino');
    expect(d.state.children.find((c) => c.id === b)?.world).toBe('explorer');
  });

  it('activates a free library challenge as an egg', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    const challenge = d.state.challenges.find((c) => c.id === id);
    expect(challenge?.status).toBe('active');
    expect(challenge?.source).toBe('library');
  });

  it('runs the full loop and hatches the first creature of the branch', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));

    d.run({ type: 'recordAttempt', challengeId: id });
    expect(d.state.challenges[0].sparks).toBe(1);

    d.run({ type: 'requestCompletion', challengeId: id });
    expect(d.state.challenges[0].status).toBe('requested');
    expect(d.events).toEqual([{ type: 'completion_requested', childId: child, challengeId: id }]);

    d.run({ type: 'approveCompletion', challengeId: id, note: 'Så stolt!' });
    const challenge = d.state.challenges[0];
    expect(challenge.status).toBe('completed');
    expect(totalStars(d.state, child)).toBe(1);
    expect(spendableStars(d.state, child)).toBe(1);

    const completion = d.state.completions[0];
    expect(completion.creatureId).toBe('valley_kropp_1');
    expect(completion.parentNote).toBe('Så stolt!');
    expect(completion.cardText).toContain('Evelyn');
    expect(completion.attemptsCount).toBe(1);

    const creature = d.state.creatures.find((c) => c.creatureId === 'valley_kropp_1');
    expect(creature).toMatchObject({ stage: 1, growth: 1, world: 'valley' });
    expect(d.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['creature_hatched', 'challenge_completed']),
    );
    const types = d.state.celebrations.map((c) => c.type);
    expect(types).toContain('hatch');
    expect(types).toContain('special'); // first spark special
  });

  it('lets the parent register a completion directly without a request', () => {
    const d = new Driver();
    const child = d.addChild('Rafael', 2021, 6);
    const id = d.activate(child, freeTemplate('mat'));
    d.run({ type: 'approveCompletion', challengeId: id });
    expect(d.state.challenges[0].status).toBe('completed');
    expect(d.state.completions[0].approvedBy).toBe('parent-1');
  });

  it('uses the AI/parent card text when given', () => {
    const d = new Driver();
    const child = d.addChild('Rafael', 2021, 6);
    const id = d.activate(child, freeTemplate('mat'));
    d.run({ type: 'approveCompletion', challengeId: id, cardText: 'Rafael bredde sin första smörgås!' });
    expect(d.state.completions[0].cardText).toBe('Rafael bredde sin första smörgås!');
  });

  it('cannot approve twice or approve an archived challenge', () => {
    const d = new Driver();
    const child = d.addChild('Rafael', 2021, 6);
    const id = d.activate(child, freeTemplate('mat'));
    d.run({ type: 'approveCompletion', challengeId: id });
    expect(d.try({ type: 'approveCompletion', challengeId: id })).toMatchObject({ ok: false, error: 'invalid_status' });
    const other = d.activate(child, freeTemplate('hem'));
    d.run({ type: 'setChallengeStatus', challengeId: other, status: 'archived' });
    expect(d.try({ type: 'approveCompletion', challengeId: other })).toMatchObject({ ok: false, error: 'invalid_status' });
  });

  it('increments the revision on every write and never mutates the input', () => {
    const d = new Driver();
    const before = d.state;
    d.addChild('Evelyn', 2020, 3);
    expect(d.state.family.revision).toBe(1);
    expect(before.children).toHaveLength(0);
  });
});

describe('sparks (spec 3.2)', () => {
  it('gives max one child spark per challenge and day', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'recordAttempt', challengeId: id });
    d.run({ type: 'recordAttempt', challengeId: id });
    expect(d.events).toEqual([{ type: 'spark_already_today', childId: child, challengeId: id }]);
    expect(d.state.challenges[0].sparks).toBe(1);
    expect(d.state.attempts).toHaveLength(2);
    expect(d.state.attempts[1].sparkAwarded).toBe(false);

    d.addDays(1).run({ type: 'recordAttempt', challengeId: id });
    expect(d.state.challenges[0].sparks).toBe(2);
  });

  it('never gives a child spark for a day before the latest spark (backdated attempts)', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    d.addDays(1).run({ type: 'recordAttempt', challengeId: id });
    d.addDays(-1).run({ type: 'recordAttempt', challengeId: id });

    expect(d.events).toEqual([{ type: 'spark_already_today', childId: child, challengeId: id }]);
    expect(d.state.challenges[0].sparks).toBe(1);
    expect(d.state.challenges[0].lastSparkDay).toBe('2026-10-08');
  });

  it('gives a bonus star at every third spark', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    for (let day = 0; day < 3; day += 1) d.addDays(day === 0 ? 0 : 1).run({ type: 'recordAttempt', challengeId: id });
    expect(d.state.ledger).toHaveLength(1);
    expect(d.state.ledger[0]).toMatchObject({ reason: 'spark_bonus', delta: 1, branch: 'kropp' });
    expect(d.events.map((e) => e.type)).toContain('bonus_star');
  });

  it('can turn the bonus star rule off', () => {
    const d = new Driver();
    d.run({ type: 'updateSettings', settings: { sparkBonusEnabled: false } });
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    for (let day = 0; day < 3; day += 1) d.addDays(1).run({ type: 'recordAttempt', challengeId: id });
    expect(d.state.ledger).toHaveLength(0);
    expect(d.state.challenges[0].sparks).toBe(3);
  });

  it('lets the parent give a spark instead of approving, sending the egg back', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'recordAttempt', challengeId: id });
    d.run({ type: 'requestCompletion', challengeId: id });
    d.run({ type: 'giveSpark', challengeId: id });
    expect(d.state.challenges[0]).toMatchObject({ status: 'active', sparks: 2, requestedAt: null });
  });

  it('does not accept attempts on paused challenges', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'setChallengeStatus', challengeId: id, status: 'paused' });
    expect(d.try({ type: 'recordAttempt', challengeId: id })).toMatchObject({ ok: false, error: 'invalid_status' });
  });

  it('unlocks the first-spark special only once', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const a = d.activate(child, freeTemplate('kropp'));
    const b = d.activate(child, freeTemplate('mat'));
    d.run({ type: 'recordAttempt', challengeId: a });
    d.run({ type: 'recordAttempt', challengeId: b });
    expect(d.state.creatures.filter((c) => c.creatureId === 'valley_special_first_spark')).toHaveLength(1);
  });
});

describe('plan limits (spec 13)', () => {
  it('allows one child on the free plan', () => {
    const d = new Driver();
    d.addChild('Evelyn', 2020, 3);
    expect(d.try({ type: 'addChild', firstName: 'Rafael', birthYear: 2021, birthMonth: 6 })).toMatchObject({
      ok: false,
      error: 'plus_required',
    });
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    d.addChild('Rafael', 2021, 6);
    expect(d.state.children).toHaveLength(2);
  });

  it('only allows the free library subset without Plus', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    expect(d.try({ type: 'activateTemplate', childId: child, templateId: plusTemplate() })).toMatchObject({
      ok: false,
      error: 'plus_required',
    });
  });

  it('validates child input', () => {
    const d = new Driver();
    expect(d.try({ type: 'addChild', firstName: '   ', birthYear: 2020, birthMonth: 3 })).toMatchObject({ ok: false });
    expect(d.try({ type: 'addChild', firstName: 'A', birthYear: 2026, birthMonth: 3 })).toMatchObject({ ok: false });
    expect(d.try({ type: 'addChild', firstName: 'A', birthYear: 2020, birthMonth: 13 })).toMatchObject({ ok: false });
  });

  it('limits the number of active challenges', () => {
    const d = new Driver();
    d.run({ type: 'updateSettings', settings: { maxActiveChallenges: 2 } });
    const child = d.addChild('Evelyn', 2020, 3);
    d.custom(child, 'kropp');
    d.custom(child, 'mat');
    expect(
      d.try({ type: 'addCustomChallenge', childId: child, title: 'Tre', branch: 'hem', icon: '🏠' }),
    ).toMatchObject({ ok: false, error: 'max_active_reached' });
  });

  it('rejects duplicate active library challenges', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const template = freeTemplate('kropp');
    d.activate(child, template);
    expect(d.try({ type: 'activateTemplate', childId: child, templateId: template })).toMatchObject({
      ok: false,
      error: 'already_exists',
    });
  });

  it('switches off Plus-only competitions when Plus ends', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    d.run({ type: 'updateCompetitions', siblingDuelEnabled: true, familyGoalEnabled: true });
    d.run({ type: 'setPlus', active: false }, SYSTEM);
    expect(d.state.competitions).toMatchObject({ siblingDuelEnabled: false, familyGoalEnabled: false });
  });
});
