import { duelScores, duelWinners, selfStats, weekMessage, weeklyHistory } from '@/domain/competitions';
import { weekStartKey } from '@/domain/time';
import { Driver, START, SYSTEM } from '../helpers';

const TZ = 'Europe/Stockholm';

function duelFamily() {
  const d = new Driver();
  d.run({ type: 'setPlus', active: true }, SYSTEM);
  const evelyn = d.addChild('Evelyn', 2020, 3);
  const rafael = d.addChild('Rafael', 2021, 6);
  d.run({ type: 'updateCompetitions', siblingDuelEnabled: true });
  return { d, evelyn, rafael };
}

describe('sibling duel (spec 4)', () => {
  it('ranks by stars times handicap', () => {
    const { d, evelyn, rafael } = duelFamily();
    d.completeIn(evelyn, 'kropp');
    d.completeIn(evelyn, 'kropp');
    d.completeIn(rafael, 'mat');
    d.completeIn(rafael, 'mat');
    d.run({ type: 'updateCompetitions', handicaps: { [rafael]: 1.5 } });
    const scores = duelScores(d.state, weekStartKey(d.now, TZ));
    expect(scores[0]).toMatchObject({ childId: rafael, stars: 2, score: 3 });
    expect(duelWinners(scores)).toEqual([rafael]);
  });

  it('has no winner when nobody earned stars, and supports ties', () => {
    expect(duelWinners([{ childId: 'a', stars: 0, score: 0 }])).toEqual([]);
    expect(
      duelWinners([
        { childId: 'a', stars: 2, score: 2 },
        { childId: 'b', stars: 2, score: 2 },
      ]),
    ).toEqual(['a', 'b']);
  });

  it('validates handicaps', () => {
    const { d, rafael } = duelFamily();
    expect(d.try({ type: 'updateCompetitions', handicaps: { [rafael]: 9 } })).toMatchObject({ error: 'invalid_input' });
    expect(d.try({ type: 'updateCompetitions', handicaps: { nobody: 1.5 } })).toMatchObject({ error: 'invalid_input' });
  });

  it('closes the week on Sunday evening with a trophy and a "Bra kämpat"-spark for everyone', () => {
    const { d, evelyn, rafael } = duelFamily();
    d.completeIn(evelyn, 'kropp');
    d.completeIn(evelyn, 'kropp');
    d.completeIn(rafael, 'mat');

    // Sunday 2026-10-11 at 12:00 local: too early.
    d.at('2026-10-11T10:00:00.000Z').run({ type: 'rollupWeeks' });
    expect(d.state.weeklyResults).toHaveLength(0);

    // Sunday 20:00 local.
    d.at('2026-10-11T18:00:00.000Z').run({ type: 'rollupWeeks' });
    expect(d.state.weeklyResults).toHaveLength(1);
    const week = d.state.weeklyResults[0];
    expect(week.weekStart).toBe('2026-10-05');
    expect(week.duel).toBe(true);
    expect(week.results.find((r) => r.childId === evelyn)?.isWinner).toBe(true);
    expect(week.results.find((r) => r.childId === rafael)?.isWinner).toBe(false);
    expect(d.state.celebrations.filter((c) => c.type === 'week_trophy').map((c) => c.childId)).toEqual([evelyn]);
    expect(d.state.attempts.filter((a) => a.source === 'duel')).toHaveLength(2);

    // Idempotent
    d.run({ type: 'rollupWeeks' });
    expect(d.state.weeklyResults).toHaveLength(1);
  });

  it('rolls up missed weeks but only celebrates the latest one', () => {
    const { d, evelyn } = duelFamily();
    d.completeIn(evelyn, 'kropp');
    d.at('2026-10-26T08:00:00.000Z').run({ type: 'rollupWeeks' });
    expect(d.state.weeklyResults.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(d.state.celebrations.filter((c) => c.type === 'week_trophy')).toHaveLength(0);
  });
});

describe('against myself (spec 4)', () => {
  it('tracks this week, last week and the personal record', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'kropp');
    d.completeIn(child, 'kropp');
    d.addDays(7);
    d.completeIn(child, 'mat');
    const stats = selfStats(d.state, child, d.now);
    expect(stats).toMatchObject({ thisWeek: 1, lastWeek: 2, record: 2, toRecord: 2, isNewRecord: false });
    expect(stats.history).toHaveLength(12);
    expect(stats.history[stats.history.length - 1].stars).toBe(1);
    d.completeIn(child, 'mat');
    d.completeIn(child, 'mat');
    expect(selfStats(d.state, child, d.now).isNewRecord).toBe(true);
  });

  it('celebrates a new record when the week closes', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'kropp');
    d.at('2026-10-11T18:30:00.000Z').run({ type: 'rollupWeeks' });
    expect(d.state.celebrations.some((c) => c.type === 'self_record')).toBe(true);
    expect(d.state.weeklyResults[0].duel).toBe(false);
  });

  it('builds weekly history oldest first', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const history = weeklyHistory(d.state, child, START, 3);
    expect(history.map((h) => h.weekStart)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
  });
});

describe('positive messages: a child never sees that it lost', () => {
  const base = { childId: 'x', score: 0, previousRecord: 5 };
  it.each([
    [{ ...base, stars: 7, isWinner: true, isRecord: true }, 'winner'],
    [{ ...base, stars: 6, isWinner: false, isRecord: true }, 'record'],
    [{ ...base, stars: 4, isWinner: false, isRecord: false }, 'toRecord'],
    [{ ...base, stars: 1, isWinner: false, isRecord: false }, 'effort'],
    [{ ...base, stars: 0, isWinner: false, isRecord: false }, 'start'],
  ])('%o → %s', (result, kind) => {
    expect(weekMessage(result).kind).toBe(kind);
  });
});
