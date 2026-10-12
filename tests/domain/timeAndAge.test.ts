import { ageAt, bandForAge, graduationTarget, isSupportedAge, worldForAge } from '@/domain/age';
import { addDays, dayKey, isInWeek, isWeekClosed, weekdayIndex, weekStartKey } from '@/domain/time';
import type { Child } from '@/domain/types';
import { Driver, SYSTEM } from '../helpers';

const TZ = 'Europe/Stockholm';

describe('calendar helpers', () => {
  it('uses the family time zone for day keys', () => {
    // 23:30 UTC is already the next day in Stockholm (summer time, UTC+2).
    expect(dayKey('2026-07-01T23:30:00.000Z', TZ)).toBe('2026-07-02');
    expect(dayKey('2026-07-01T21:30:00.000Z', TZ)).toBe('2026-07-01');
  });

  it('falls back to device time for unknown time zones', () => {
    expect(dayKey('2026-07-01T12:00:00.000Z', 'Not/AZone')).toMatch(/^2026-07-0[12]$/);
  });

  it('computes Monday week starts and weekday indexes', () => {
    expect(weekStartKey('2026-10-11T10:00:00.000Z', TZ)).toBe('2026-10-05');
    expect(weekStartKey('2026-10-12T10:00:00.000Z', TZ)).toBe('2026-10-12');
    expect(weekdayIndex('2026-10-12')).toBe(0);
    expect(weekdayIndex('2026-10-11')).toBe(6);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(isInWeek('2026-10-11T10:00:00.000Z', '2026-10-05', TZ)).toBe(true);
    expect(isInWeek('2026-10-12T10:00:00.000Z', '2026-10-05', TZ)).toBe(false);
  });

  it('closes a week on Sunday evening', () => {
    expect(isWeekClosed('2026-10-05', '2026-10-10T18:00:00.000Z', TZ, 19)).toBe(false);
    expect(isWeekClosed('2026-10-05', '2026-10-11T16:00:00.000Z', TZ, 19)).toBe(false);
    expect(isWeekClosed('2026-10-05', '2026-10-11T17:00:00.000Z', TZ, 19)).toBe(true);
    expect(isWeekClosed('2026-10-05', '2026-10-13T08:00:00.000Z', TZ, 19)).toBe(true);
  });
});

describe('age and worlds (spec 5)', () => {
  it('counts the birthday from the birth month', () => {
    expect(ageAt(2020, 10, '2026-10-01T10:00:00.000Z', TZ)).toBe(6);
    expect(ageAt(2020, 11, '2026-10-01T10:00:00.000Z', TZ)).toBe(5);
  });

  it('maps ages to bands and worlds', () => {
    expect([4, 6, 7, 9, 10, 13].map(bandForAge)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(worldForAge(5)).toBe('valley');
    expect(worldForAge(8)).toBe('dino');
    expect(worldForAge(12)).toBe('explorer');
    expect(isSupportedAge(3)).toBe(false);
    expect(isSupportedAge(13)).toBe(true);
  });

  it('suggests graduation when the child has grown into the next band, unless snoozed', () => {
    const child: Child = {
      id: 'c',
      familyId: 'f',
      firstName: 'Evelyn',
      birthYear: 2019,
      birthMonth: 9,
      world: 'valley',
      avatarCreatureId: null,
      graduationSnoozedAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const now = '2026-10-07T08:00:00.000Z';
    expect(graduationTarget(child, now, TZ)).toBe('dino');
    expect(graduationTarget({ ...child, graduationSnoozedAt: '2026-10-05T08:00:00.000Z' }, now, TZ)).toBeNull();
    expect(graduationTarget({ ...child, graduationSnoozedAt: '2026-09-20T08:00:00.000Z' }, now, TZ)).toBe('dino');
    expect(graduationTarget({ ...child, world: 'dino' }, now, TZ)).toBeNull();
  });
});

describe('changing worlds', () => {
  it('graduates a 7-year-old from Äggdalen to Dinodalen and keeps the collection', () => {
    const d = new Driver(undefined, '2025-10-07T08:00:00.000Z');
    const child = d.addChild('Evelyn', 2019, 9); // 6 years old: Äggdalen
    d.completeIn(child, 'kropp');
    d.at('2026-10-07T08:00:00.000Z'); // now 7
    d.run({ type: 'changeWorld', childId: child, world: 'dino' }, { kind: 'child', childIds: [child] });
    expect(d.state.children[0].world).toBe('dino');
    expect(d.state.creatures.some((c) => c.creatureId === 'valley_kropp_1')).toBe(true);
    expect(d.state.creatures.some((c) => c.creatureId === 'valley_special_graduation')).toBe(true);

    d.completeIn(child, 'kropp');
    expect(d.state.creatures.some((c) => c.creatureId === 'dino_kropp_1')).toBe(true);
  });

  it('keeps free families in the world that fits the age', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    expect(d.try({ type: 'changeWorld', childId: child, world: 'explorer' })).toMatchObject({ error: 'plus_required' });
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    d.run({ type: 'changeWorld', childId: child, world: 'explorer' });
    expect(d.state.children[0].world).toBe('explorer');
    expect(d.state.creatures.some((c) => c.creatureId.endsWith('graduation'))).toBe(false);
  });

  it('lets the child say "not yet"', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.run({ type: 'snoozeGraduation', childId: child }, { kind: 'child', childIds: [child] });
    expect(d.state.children[0].graduationSnoozedAt).toBe(d.now);
  });

  it('updates and removes a child with all its data', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    const a = d.addChild('Evelyn', 2020, 3);
    const b = d.addChild('Rafael', 2021, 6);
    d.run({ type: 'updateChild', childId: a, firstName: 'Evy' });
    expect(d.state.children[0].firstName).toBe('Evy');
    d.completeIn(a, 'kropp');
    d.completeIn(b, 'mat');
    d.run({ type: 'updateCompetitions', handicaps: { [a]: 1.5 } });
    d.run({ type: 'removeChild', childId: a });
    expect(d.state.children.map((c) => c.id)).toEqual([b]);
    expect(d.state.ledger.every((e) => e.childId === b)).toBe(true);
    expect(d.state.creatures.every((c) => c.childId === b)).toBe(true);
    expect(d.state.competitions.handicaps).toEqual({});
  });
});

describe('settings', () => {
  it('updates settings and validates ranges', () => {
    const d = new Driver();
    d.run({ type: 'updateSettings', settings: { soundEnabled: false, notifications: { reminderHour: 18 } } });
    expect(d.state.family.settings.soundEnabled).toBe(false);
    expect(d.state.family.settings.notifications).toMatchObject({ reminderHour: 18, approvals: true });
    expect(d.try({ type: 'updateSettings', settings: { maxActiveChallenges: 0 } })).toMatchObject({ ok: false });
    expect(d.try({ type: 'updateSettings', settings: { notifications: { reminderHour: 25 } } })).toMatchObject({ ok: false });
    d.run({ type: 'renameFamily', name: '  Familjen   Bandak ' });
    expect(d.state.family.name).toBe('Familjen Bandak');
  });
});
