import { messagesForEvents } from '@/backend/pushMessages';
import { totalStars } from '@/domain/stars';

import { Driver, freeTemplate, PARENT_ID, SYSTEM } from '../helpers';

function familyWithRequests() {
  const d = new Driver();
  d.run({ type: 'setPlus', active: true }, SYSTEM);
  const evelyn = d.addChild('Evelyn', 2020);
  const rafael = d.addChild('Rafael', 2021);
  const kropp = d.custom(evelyn, 'kropp');
  const mat = d.custom(evelyn, 'mat');
  const mod = d.custom(rafael, 'mod');
  const open = d.custom(rafael, 'hem');
  for (const [childId, challengeId] of [[evelyn, kropp], [evelyn, mat], [rafael, mod]]) {
    d.run({ type: 'requestCompletion', challengeId }, { kind: 'child', childIds: [childId] });
  }
  return { d, evelyn, rafael, requested: [kropp, mat, mod], open };
}

describe('approve all ("Godkänn alla")', () => {
  it('approves every waiting challenge in one command', () => {
    const { d, evelyn, rafael, requested } = familyWithRequests();
    d.run({ type: 'approveAll', challengeIds: requested });

    expect(requested.map((id) => d.state.challenges.find((c) => c.id === id)?.status)).toEqual(['completed', 'completed', 'completed']);
    expect(d.state.completions.map((c) => c.approvedBy)).toEqual([PARENT_ID, PARENT_ID, PARENT_ID]);
    expect(totalStars(d.state, evelyn)).toBe(2);
    expect(totalStars(d.state, rafael)).toBe(1);
    expect(d.events.filter((e) => e.type === 'challenge_completed')).toHaveLength(3);
  });

  it('skips challenges that are no longer waiting, but never approves unrequested eggs', () => {
    const { d, requested, open } = familyWithRequests();
    d.run({ type: 'approveCompletion', challengeId: requested[0] });
    d.run({ type: 'approveAll', challengeIds: [...requested, open] });

    expect(d.state.completions).toHaveLength(3);
    expect(d.state.challenges.find((c) => c.id === open)?.status).toBe('active');
  });

  it('fails when nothing is waiting and rejects bad input', () => {
    const { d, requested, open } = familyWithRequests();
    expect(d.try({ type: 'approveAll', challengeIds: [open] })).toMatchObject({ ok: false, error: 'invalid_status' });
    expect(d.try({ type: 'approveAll', challengeIds: [] })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(d.try({ type: 'approveAll', challengeIds: Array(51).fill(requested[0]) })).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(d.try({ type: 'approveAll', challengeIds: [42 as unknown as string] })).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('is for parents only', () => {
    const { d, evelyn, requested } = familyWithRequests();
    expect(d.try({ type: 'approveAll', challengeIds: requested }, { kind: 'child', childIds: [evelyn] })).toMatchObject({
      ok: false,
      error: 'forbidden',
    });
  });

  it('sends each child one push, however many eggs were approved', () => {
    const { d, evelyn, rafael, requested } = familyWithRequests();
    d.run({ type: 'approveAll', challengeIds: requested });
    const childPushes = messagesForEvents(d.state, d.events).filter((m) => m.audience.kind === 'child');

    expect(childPushes.map((m) => m.audience)).toEqual([
      { kind: 'child', childId: evelyn },
      { kind: 'child', childId: rafael },
    ]);
  });

  it('works with library challenges too', () => {
    const d = new Driver();
    const child = d.addChild('Ida', 2020);
    const challengeId = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'requestCompletion', challengeId }, { kind: 'child', childIds: [child] });
    d.run({ type: 'approveAll', challengeIds: [challengeId] });
    expect(d.state.challenges[0].status).toBe('completed');
  });
});
