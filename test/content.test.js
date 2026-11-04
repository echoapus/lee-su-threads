import { it, expect, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
vi.mock('country-flag-emoji-polyfill', () => ({ polyfillCountryFlagEmojis: vi.fn() }));
vi.mock('../src/lib/profileFetcher.js', () => ({
  getUserIdByUsername: vi.fn(async () => '123'),
  fetchProfileByUserId: vi.fn(async () => ({ _rateLimited: true }))
}));
let dom;
afterEach(() => { dom?.window.close(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('restores the manual feed button after a rate limit', async () => {
  vi.useFakeTimers();
  dom = new JSDOM('<article><a href="/@alice">alice</a><span><time>now</time></span></article>', { url: 'https://www.threads.com' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('MutationObserver', dom.window.MutationObserver);
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} });
  vi.stubGlobal('chrome', {
    i18n: { getMessage: () => '' },
    runtime: { getURL: path => path, sendMessage: async () => ({}) }
  });
  await import('../src/content.js');
  await vi.advanceTimersByTimeAsync(1000);
  const btn = document.querySelector('.threads-fetch-btn');
  expect(btn).not.toBeNull();
  btn.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(btn.disabled).toBe(false);
  expect(btn.textContent).toBe('🔄');
  dom.window.dispatchEvent(new dom.window.Event('beforeunload'));
});
