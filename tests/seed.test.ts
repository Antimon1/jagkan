import { z } from 'zod';

import challenges from '../seed/challenges.json';
import creatures from '../seed/creatures.json';
import milestones from '../seed/milestones.json';
import rewardSuggestions from '../seed/reward_suggestions.json';
import { BRANCHES, WORLDS } from '@/domain/constants';

const branch = z.enum(BRANCHES as [string, ...string[]]);
const world = z.enum(WORLDS as [string, ...string[]]);
const age = z.number().int().min(4).max(13);

const challengeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    branch,
    ageMin: age,
    ageMax: age,
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    titleChild: z.string().min(3).max(60),
    titleParent: z.string().min(3).max(120),
    icon: z.string().min(1).max(16),
    parentTip: z.string().min(10).max(300),
    repeatable: z.boolean(),
    reward: z.enum(['star', 'praise']),
    tags: z.array(z.string()).min(1).max(3),
    isPlus: z.boolean(),
  })
  .strict()
  .refine((c) => c.ageMin <= c.ageMax, 'ageMin <= ageMax');

const stage = z.object({
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  name: z.string().min(2),
  emoji: z.string().min(1),
  assetKey: z.string().regex(/^[a-z]+\/[a-z0-9_]+$/),
});

const creaturesSchema = z.object({
  version: z.literal(1),
  worlds: z.array(z.object({ id: world, name: z.string(), band: z.number(), ageMin: age, ageMax: age }).passthrough()).length(3),
  species: z
    .array(
      z.object({
        id: z.string(),
        world,
        branch,
        slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        personality: z.string().min(5),
        stages: z.array(stage).length(3),
      }),
    )
    .length(63),
  specials: z
    .array(
      z.object({
        id: z.string(),
        world,
        name: z.string(),
        emoji: z.string(),
        assetKey: z.string(),
        personality: z.string(),
        unlock: z.union([
          z.object({ type: z.literal('milestone'), milestoneId: z.string() }),
          z.object({ type: z.enum(['first_spark', 'family_goal', 'graduation']) }),
        ]),
      }),
    )
    .length(30),
});

describe('seed data (spec 6.4 and 5)', () => {
  it('has at least 150 valid, unique challenges', () => {
    const parsed = z.array(challengeSchema).parse(challenges);
    expect(parsed.length).toBeGreaterThanOrEqual(150);
    expect(new Set(parsed.map((c) => c.id)).size).toBe(parsed.length);
  });

  it('covers every branch in every age band', () => {
    const bands: [number, number][] = [
      [4, 6],
      [7, 9],
      [10, 13],
    ];
    for (const [min, max] of bands) {
      for (const b of BRANCHES) {
        const count = challenges.filter((c) => c.branch === b && c.ageMax >= min && c.ageMin <= max).length;
        expect({ band: `${min}-${max}`, branch: b, ok: count >= 6 }).toEqual({ band: `${min}-${max}`, branch: b, ok: true });
      }
    }
  });

  it('has a free basic selection of about 40 (spec 13)', () => {
    const free = challenges.filter((c) => !c.isPlus).length;
    expect(free).toBeGreaterThanOrEqual(35);
    expect(free).toBeLessThanOrEqual(45);
  });

  it('includes the examples from the spec', () => {
    const titles = challenges.map((c) => c.titleChild);
    for (const title of ['Dra upp blixtlåset själv', 'Bre min egen smörgås', 'Knyta skorna', 'Åka kollektivtrafik själv', 'Simma 25 meter']) {
      expect(titles).toContain(title);
    }
  });

  it('has 3 worlds × 7 branches × 3 creatures and 10 specials per world', () => {
    const parsed = creaturesSchema.parse(creatures);
    for (const w of WORLDS) {
      for (const b of BRANCHES) {
        const slots = parsed.species.filter((s) => s.world === w && s.branch === b).map((s) => s.slot).sort();
        expect(slots).toEqual([1, 2, 3]);
      }
      expect(parsed.specials.filter((s) => s.world === w)).toHaveLength(10);
    }
    const ids = [...parsed.species.map((s) => s.id), ...parsed.specials.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links every milestone special to a milestone', () => {
    const milestoneIds = new Set(milestones.map((m) => m.id));
    for (const s of creatures.specials) {
      if (s.unlock.type === 'milestone') expect(milestoneIds.has((s.unlock as { milestoneId: string }).milestoneId)).toBe(true);
    }
    expect(milestones.map((m) => m.thresholdStars)).toEqual([5, 10, 25, 50, 100, 200, 365]);
  });

  it('has reward suggestions including the spec examples', () => {
    const titles = rewardSuggestions.map((r) => r.title);
    expect(titles).toEqual(expect.arrayContaining(['Välja middag', 'Extra godnattsaga', 'Biokväll', '30 min extra skärmtid']));
    expect(rewardSuggestions.every((r) => r.costStars >= 1 && r.ageMin <= r.ageMax)).toBe(true);
  });

  it('never uses losing or failing language in child-facing texts', () => {
    const banned = /förlor|förlust|misslyck|dålig|sämst|fel på dig/i;
    const texts = [
      ...challenges.map((c) => c.titleChild),
      ...creatures.species.flatMap((s) => [s.personality, ...s.stages.map((x) => x.name)]),
      ...creatures.specials.map((s) => s.personality),
    ];
    expect(texts.filter((t) => banned.test(t))).toEqual([]);
  });
});
