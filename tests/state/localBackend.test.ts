import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/lib/storage';
import { createLocalBackend, saveLocalFamily } from '@/state/localBackend';

import { Driver } from '../helpers';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('local backend (one shared device, no account)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('saves every change on the device and loads it again', async () => {
    const d = new Driver();
    d.addChild('Evelyn', 2020);
    const backend = createLocalBackend();

    expect(await backend.load()).toBeNull();
    expect(await backend.commit({ type: 'rollupWeeks' }, d.state)).toEqual({ status: 'saved' });
    expect(await backend.load()).toEqual(d.state);
    expect(backend.pending()).toBe(0);
  });

  it('upgrades a family saved by an older version with AI suggestions', async () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020);
    const id = d.custom(child, 'kropp');
    const legacy = {
      ...d.state,
      aiSuggestions: [{ id: 's1' }],
      challenges: d.state.challenges.map((c) => (c.id === id ? { ...c, status: 'suggested', source: 'ai' } : c)),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.localFamily, JSON.stringify(legacy));

    const loaded = await createLocalBackend().load();
    expect(loaded).not.toHaveProperty('aiSuggestions');
    expect(loaded?.challenges[0]).toMatchObject({ status: 'paused', source: 'custom' });
  });

  it('ignores data that is not a family and clears the device', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.localFamily, JSON.stringify({ schemaVersion: 99 }));
    const backend = createLocalBackend();
    expect(await backend.load()).toBeNull();

    expect(await saveLocalFamily(new Driver().state)).toBe(true);
    await backend.clear();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.localFamily)).toBeNull();
  });
});
