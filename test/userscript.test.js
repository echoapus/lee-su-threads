import { beforeEach, afterEach, it, expect, vi } from 'vitest';

let store, browserAPI;
beforeEach(async () => {
  vi.resetModules();
  store = new Map();
  vi.stubGlobal('navigator', { language: 'zh-TW', languages: ['zh-TW'] });
  vi.stubGlobal('GM_getValue', key => structuredClone(store.get(key)));
  vi.stubGlobal('GM_setValue', (key, value) => store.set(key, structuredClone(value)));
  vi.stubGlobal('GM_listValues', () => [...store.keys()]);
  vi.stubGlobal('GM_deleteValue', key => store.delete(key));
  ({ browserAPI } = await import('../src/userscript/browserAPI.js'));
});
afterEach(() => vi.unstubAllGlobals());

it('keeps concurrent account writes and replaces changed user IDs', async () => {
  await Promise.all(['alice', 'bob'].map(username => browserAPI.runtime.sendMessage({
    type: 'PROFILE_INFO_EXTRACTED', data: { username, location: 'Taiwan' }
  })));
  const cache = await browserAPI.runtime.sendMessage({ type: 'GET_CACHED_PROFILES' });
  expect(Object.keys(cache)).toEqual(['alice', 'bob']);
  await browserAPI.runtime.sendMessage({ type: 'STORE_USER_IDS', data: { alice: '1', bob: '2' } });
  await browserAPI.runtime.sendMessage({ type: 'STORE_USER_IDS', data: { alice: '3' } });
  const ids = await browserAPI.runtime.sendMessage({ type: 'GET_USER_ID_CACHE' });
  expect(ids.alice.userId).toBe('3');
  expect(ids.bob.userId).toBe('2');
});

it('applies the shared TTLs, removes expired entries and leaves unrelated storage alone', async () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  store.set('profile:withLocation', { location: 'Taiwan', timestamp: now - 20 * day });
  store.set('profile:withoutLocation', { timestamp: now - day });
  store.set('profile:oldLocation', { location: 'Taiwan', timestamp: now - 21 * day });
  store.set('userId:current', { userId: '1', timestamp: now - 59 * day });
  store.set('userId:expired', { userId: '2', timestamp: now - 60 * day });
  store.set('other', true);
  expect(Object.keys(await browserAPI.runtime.sendMessage({ type: 'GET_CACHED_PROFILES' }))).toEqual(['withLocation']);
  expect(Object.keys(await browserAPI.runtime.sendMessage({ type: 'GET_USER_ID_CACHE' }))).toEqual(['current']);
  expect(store.has('profile:withoutLocation')).toBe(false);
  expect(store.has('profile:oldLocation')).toBe(false);
  expect(store.has('userId:expired')).toBe(false);
  expect(store.get('other')).toBe(true);
});

it('uses English even with a non-English browser and handles unknown message keys', () => {
  expect(browserAPI.i18n.getMessage('extName')).toBe('MetaThreadsCountryInfo');
  expect(browserAPI.i18n.getMessage('noLocationData')).toBe('No location data');
  expect(browserAPI.i18n.getMessage('missing-key')).toBe('');
});

it('propagates storage errors to callers', async () => {
  vi.stubGlobal('GM_setValue', () => { throw new Error('storage unavailable'); });
  await expect(browserAPI.runtime.sendMessage({ type: 'STORE_USER_IDS', data: { alice: '1' } })).rejects.toThrow('storage unavailable');
});
