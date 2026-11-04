import { beforeEach, afterEach, expect, it, vi } from 'vitest';

let listener, startup, store, set;
beforeEach(async () => {
  vi.resetModules();
  store = {};
  set = vi.fn(async data => {
    await Promise.resolve();
    Object.assign(store, structuredClone(data));
  });
  vi.stubGlobal('chrome', {
    storage: { local: {
      get: async keys => structuredClone(Object.fromEntries(keys.map(key => [key, store[key]]))),
      set
    } },
    runtime: {
      onMessage: { addListener: fn => { listener = fn; } },
      onStartup: { addListener: fn => { startup = fn; } }
    }
  });
  await import('../src/background.js');
});
afterEach(() => vi.unstubAllGlobals());
const message = data => new Promise(resolve => listener(data, {}, resolve));

it('preserves concurrent profile and ID writes, including startup cleanup', async () => {
  const alice = message({ type: 'PROFILE_INFO_EXTRACTED', data: { username: 'alice' } });
  startup();
  const bob = message({ type: 'PROFILE_INFO_EXTRACTED', data: { username: 'bob' } });
  const ids = ['alice', 'bob'].map((name, i) => message({ type: 'STORE_USER_IDS', data: { [name]: String(i) } }));
  await Promise.all([alice, bob, ...ids]);
  expect(Object.keys(store.profileCache)).toEqual(['alice', 'bob']);
  expect(Object.keys(store.userIdCache)).toEqual(['alice', 'bob']);
});

it('replaces changed IDs and excludes expired mappings', async () => {
  store.userIdCache = { alice: { userId: '1', timestamp: 0 }, expired: { userId: '3', timestamp: 0 } };
  await message({ type: 'STORE_USER_IDS', data: { alice: '2' } });
  const cache = await message({ type: 'GET_USER_ID_CACHE' });
  expect(cache.alice.userId).toBe('2');
  expect(cache).not.toHaveProperty('expired');
});

it('reports a failed write and keeps processing later messages', async () => {
  set.mockRejectedValueOnce(new Error('storage unavailable'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await message({ type: 'STORE_USER_IDS', data: { alice: '1' } });
  await message({ type: 'STORE_USER_IDS', data: { bob: '2' } });
  expect(error).toHaveBeenCalled();
  expect(store.userIdCache.bob.userId).toBe('2');
  error.mockRestore();
});
