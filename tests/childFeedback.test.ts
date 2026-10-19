import { actionFeedback, CONFETTI_CELEBRATIONS } from '@/features/child/feedback';
import { Driver, freeTemplate } from './helpers';

const CHILD = (childId: string) => ({ kind: 'child' as const, childIds: [childId] });

describe('child feedback on the egg', () => {
  it('answers "Jag klarade det!" calmly: a grown-up will look', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'requestCompletion', challengeId: id }, CHILD(child));

    expect(actionFeedback('did', d.events)).toEqual({ textKey: 'child.sentToParent', emoji: '⏳', sound: 'chime', haptic: 'light' });
    expect(actionFeedback('did', null)).toMatchObject({ textKey: 'child.alreadySent', sound: null });
  });

  it('plays confetti only after a parent approves', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'recordAttempt', challengeId: id }, CHILD(child));
    const confetti = () => d.state.celebrations.filter((c) => CONFETTI_CELEBRATIONS.has(c.type)).map((c) => c.type);
    const before = confetti();

    d.run({ type: 'requestCompletion', challengeId: id }, CHILD(child));
    expect(confetti()).toEqual(before);

    d.run({ type: 'approveCompletion', challengeId: id });
    expect(confetti()).toEqual([...before, 'hatch']);
  });

  it('cheers tries with sparks and bonus stars', () => {
    expect(actionFeedback('tried', [{ type: 'spark_added', childId: 'c', challengeId: 'x', sparks: 1 }])).toMatchObject({
      textKey: 'child.sparkGot',
    });
    expect(actionFeedback('tried', [{ type: 'bonus_star', childId: 'c', challengeId: 'x' }])).toMatchObject({ textKey: 'child.bonusStar' });
    expect(actionFeedback('tried', [{ type: 'spark_already_today', childId: 'c', challengeId: 'x' }])).toMatchObject({
      textKey: 'child.sparkTomorrow',
    });
    expect(actionFeedback('tried', null)).toBeNull();
  });
});
