import { effectiveNow, MAX_CLOCK_SKEW_MS, MAX_OFFLINE_AGE_MS } from '@/backend/clientTime';
import { messagesForEvents, weeklySummaryMessage } from '@/backend/pushMessages';
import { plusChangesFromEvent, safeEqual } from '@/backend/revenuecat';
import { stars } from '@/backend/starsText';
import { catalog } from '@/data/catalog';
import type { WeeklyResult } from '@/domain/types';

import { Driver, freeTemplate, START } from '../helpers';

const FAMILY = '0b8a2c1e-5d6f-4a7b-9c8d-1e2f3a4b5c6d';
const OTHER = '1c9b3d2f-6e7a-4b8c-8d9e-2f3a4b5c6d7e';
const NOW = Date.parse(START);
const PROD = { allowSandbox: false };

describe('effectiveNow', () => {
  const server = START;
  const offset = (ms: number) => new Date(NOW + ms).toISOString();

  it('keeps a recent client time for queued offline actions', () => {
    expect(effectiveNow(server, offset(-2 * 60 * 60 * 1000))).toBe(offset(-2 * 60 * 60 * 1000));
  });

  it('never moves past the server time and ignores bad or out-of-window values', () => {
    expect(effectiveNow(server, offset(60_000))).toBe(server);
    expect(effectiveNow(server, offset(MAX_CLOCK_SKEW_MS + 1))).toBe(server);
    expect(effectiveNow(server, offset(-MAX_OFFLINE_AGE_MS - 1))).toBe(server);
    expect(effectiveNow(server, 'inte ett datum')).toBe(server);
    expect(effectiveNow(server, 42)).toBe(server);
  });
});

describe('RevenueCat events', () => {
  const event = (fields: Record<string, unknown>) => ({ event: { app_user_id: FAMILY, entitlement_ids: ['plus'], ...fields } });

  it('turns Plus on for purchases and renewals that have not expired', () => {
    expect(plusChangesFromEvent(event({ type: 'INITIAL_PURCHASE', expiration_at_ms: NOW + 1000, event_timestamp_ms: NOW }), NOW, PROD)).toEqual([{ familyId: FAMILY, active: true, eventMs: NOW }]);
    expect(plusChangesFromEvent(event({ type: 'RENEWAL', expiration_at_ms: NOW - 1000 }), NOW, PROD)).toEqual([{ familyId: FAMILY, active: false, eventMs: null }]);
    expect(plusChangesFromEvent(event({ type: 'NON_RENEWING_PURCHASE' }), NOW, PROD)).toEqual([{ familyId: FAMILY, active: true, eventMs: null }]);
  });

  it('turns Plus off on expiration but not on cancellation', () => {
    expect(plusChangesFromEvent(event({ type: 'EXPIRATION' }), NOW, PROD)).toEqual([{ familyId: FAMILY, active: false, eventMs: null }]);
    expect(plusChangesFromEvent(event({ type: 'CANCELLATION' }), NOW, PROD)).toEqual([]);
    expect(plusChangesFromEvent(event({ type: 'BILLING_ISSUE' }), NOW, PROD)).toEqual([]);
  });

  it('moves Plus between families on transfer', () => {
    expect(plusChangesFromEvent({ event: { type: 'TRANSFER', transferred_from: [FAMILY], transferred_to: [OTHER, 'not-a-uuid'] } }, NOW, PROD)).toEqual([
      { familyId: FAMILY, active: false, eventMs: null },
      { familyId: OTHER, active: true, eventMs: null },
    ]);
  });

  it('ignores test events, other entitlements and malformed bodies', () => {
    expect(plusChangesFromEvent(event({ type: 'TEST' }), NOW, PROD)).toEqual([]);
    expect(plusChangesFromEvent(event({ type: 'INITIAL_PURCHASE', entitlement_ids: ['annat'] }), NOW, PROD)).toEqual([]);
    expect(plusChangesFromEvent({ event: { type: 'INITIAL_PURCHASE', app_user_id: 'anon', entitlement_ids: ['plus'] } }, NOW, PROD)).toEqual([]);
    expect(plusChangesFromEvent(null, NOW, PROD)).toEqual([]);
  });

  it('ignores sandbox purchases unless allowed', () => {
    const sandbox = event({ type: 'INITIAL_PURCHASE', environment: 'SANDBOX' });
    expect(plusChangesFromEvent(sandbox, NOW, PROD)).toEqual([]);
    expect(plusChangesFromEvent(sandbox, NOW, { allowSandbox: true })).toEqual([{ familyId: FAMILY, active: true, eventMs: null }]);
  });

  it('compares secrets in constant time', () => {
    expect(safeEqual('hemligt', 'hemligt')).toBe(true);
    expect(safeEqual('hemligt', 'hemligT')).toBe(false);
    expect(safeEqual('kort', 'längre')).toBe(false);
  });
});

describe('push messages', () => {
  function family() {
    const driver = new Driver();
    const childId = driver.addChild('Evelyn', 2021);
    const challengeId = driver.activate(childId, freeTemplate());
    return { driver, childId, challengeId };
  }

  it('sends an approval request to the parents that opens the approval card', () => {
    const { driver, childId, challengeId } = family();
    driver.run({ type: 'requestCompletion', challengeId }, { kind: 'child', childIds: [childId] });
    const [message] = messagesForEvents(driver.state, driver.events, catalog);

    expect(message.audience).toEqual({ kind: 'parents' });
    expect(message.title).toBe('Evelyn säger: Jag klarade det!');
    expect(message.url).toBe(`/parent/approve/${challengeId}`);
  });

  it('tells the child about approvals and respects the parents notification setting', () => {
    const { driver, childId, challengeId } = family();
    driver.run({ type: 'updateSettings', settings: { notifications: { approvals: false } } });
    driver.run({ type: 'requestCompletion', challengeId }, { kind: 'child', childIds: [childId] });
    expect(messagesForEvents(driver.state, driver.events, catalog)).toEqual([]);

    driver.run({ type: 'approveCompletion', challengeId });
    const childMessages = messagesForEvents(driver.state, driver.events, catalog);
    expect(childMessages).toEqual([expect.objectContaining({ audience: { kind: 'child', childId }, url: '/child' })]);
  });

  it('covers reward requests and confirmations', () => {
    const { driver, childId } = family();
    driver.run({ type: 'createReward', title: 'Glass', icon: '🍦', costStars: 1, childId: null });
    const rewardId = driver.state.rewards[0].id;
    const challengeId = driver.custom(childId, 'hem');
    driver.run({ type: 'approveCompletion', challengeId });
    driver.run({ type: 'requestReward', rewardId, childId }, { kind: 'child', childIds: [childId] });
    expect(messagesForEvents(driver.state, driver.events, catalog)[0].body).toBe('Evelyn vill ha: Glass');

    driver.run({ type: 'resolveRewardRequest', requestId: driver.state.rewardRequests[0].id, confirm: true });
    expect(messagesForEvents(driver.state, driver.events, catalog)[0].body).toBe('Belöningen är din: Glass!');
  });

  it('summarises the week for the parents', () => {
    const { driver, childId } = family();
    const result: WeeklyResult = {
      id: 'w1',
      familyId: driver.state.family.id,
      weekStart: '2026-10-05',
      duel: true,
      results: [{ childId, stars: 1, score: 1, isWinner: true, isRecord: false, previousRecord: 0 }],
      createdAt: START,
    };
    expect(weeklySummaryMessage(driver.state, result)?.body).toBe('Evelyn vann veckan! 🏆 Evelyn 1 stjärna');
    expect(weeklySummaryMessage(driver.state, { ...result, results: [] })).toBeNull();
    expect(stars(3)).toBe('3 stjärnor');
  });
});
