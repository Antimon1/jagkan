import { authorize, targetChildId } from '@/domain/engine';
import type { Actor } from '@/domain/types';
import { Driver, emptyFamily, freeTemplate, SYSTEM } from '../helpers';

function twoKids() {
  const d = new Driver();
  d.run({ type: 'setPlus', active: true }, SYSTEM);
  const evelyn = d.addChild('Evelyn', 2020, 3);
  const rafael = d.addChild('Rafael', 2021, 6);
  const egg = d.activate(evelyn, freeTemplate('kropp'));
  const rafaelEgg = d.activate(rafael, freeTemplate('mat'));
  const device: Actor = { kind: 'child', childIds: [evelyn] };
  return { d, evelyn, rafael, egg, rafaelEgg, device };
}

describe('authorization (spec 14.1 RLS rules, enforced in the engine)', () => {
  it('lets a child device try and request on its own child', () => {
    const { d, egg, device } = twoKids();
    d.run({ type: 'recordAttempt', challengeId: egg }, device);
    d.run({ type: 'requestCompletion', challengeId: egg }, device);
    expect(d.state.challenges.find((c) => c.id === egg)?.status).toBe('requested');
  });

  it('never lets a child device approve or create content', () => {
    const { d, egg, evelyn, device } = twoKids();
    expect(d.try({ type: 'approveCompletion', challengeId: egg }, device)).toMatchObject({ error: 'forbidden' });
    expect(d.try({ type: 'giveSpark', challengeId: egg }, device)).toMatchObject({ error: 'forbidden' });
    expect(
      d.try({ type: 'addCustomChallenge', childId: evelyn, title: 'x', branch: 'mod', icon: '⭐' }, device),
    ).toMatchObject({ error: 'forbidden' });
    expect(d.try({ type: 'createReward', title: 'x', icon: '⭐', costStars: 1, childId: null }, device)).toMatchObject({
      error: 'forbidden',
    });
  });

  it('keeps a child device away from siblings it is not paired with', () => {
    const { d, rafaelEgg, rafael, device } = twoKids();
    expect(d.try({ type: 'recordAttempt', challengeId: rafaelEgg }, device)).toMatchObject({ error: 'forbidden' });
    expect(d.try({ type: 'markCelebrationsSeen', childId: rafael, celebrationIds: [] }, device)).toMatchObject({
      error: 'forbidden',
    });
  });

  it('reserves Plus writes for trusted server code', () => {
    const { d } = twoKids();
    expect(d.try({ type: 'setPlus', active: false })).toMatchObject({ error: 'forbidden' });
  });

  it('rejects parents from another family', () => {
    const state = emptyFamily();
    expect(authorize(state, { type: 'renameFamily', name: 'X' }, { kind: 'parent', parentId: 'stranger' })).toMatchObject({
      error: 'forbidden',
    });
  });

  it('resolves the target child of every child-scoped command', () => {
    const { d, egg, evelyn } = twoKids();
    expect(targetChildId(d.state, { type: 'recordAttempt', challengeId: egg })).toBe(evelyn);
    expect(targetChildId(d.state, { type: 'recordAttempt', challengeId: 'missing' })).toBeNull();
    expect(targetChildId(d.state, { type: 'renameFamily', name: 'x' })).toBeNull();
  });

  it('allows a paired shared tablet to act for each of its children', () => {
    const { d, egg, rafaelEgg, evelyn, rafael } = twoKids();
    const tablet: Actor = { kind: 'child', childIds: [evelyn, rafael] };
    d.run({ type: 'recordAttempt', challengeId: egg }, tablet);
    d.run({ type: 'recordAttempt', challengeId: rafaelEgg }, tablet);
    expect(d.state.attempts).toHaveLength(2);
  });
});
