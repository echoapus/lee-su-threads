import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

let dom, displayProfileInfo, createProfileBadge, injectLocationUIForUser, createLocationBadge;
beforeEach(async () => {
  vi.resetModules();
  dom = new JSDOM('<button class="threads-fetch-btn" data-username="alice"></button>');
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('chrome', { i18n: { getMessage: () => '' } });
  ({ displayProfileInfo, createProfileBadge } = await import('../src/lib/postUI.js'));
  ({ injectLocationUIForUser, createLocationBadge } = await import('../src/lib/friendshipsUI.js'));
});
afterEach(() => { dom.window.close(); vi.unstubAllGlobals(); });
const profile = { username: 'alice', location: 'Taiwan', joined: 'January 2020' };

it('renders feed badges immediately and only once across repeated updates', () => {
  expect(createProfileBadge(profile)).toBeInstanceOf(dom.window.HTMLElement);
  displayProfileInfo(profile);
  displayProfileInfo(profile);
  expect(document.querySelectorAll('.threads-profile-info-badge')).toHaveLength(1);
  expect(document.querySelector('.threads-fetch-btn').style.display).toBe('none');
});

it('renders a cached follower badge once before the next update can run', () => {
  document.body.innerHTML = '<div><div><a href="/@alice">alice</a></div><div role="button">Follow</div></div>';
  expect(createLocationBadge(profile)).toBeInstanceOf(dom.window.HTMLElement);
  const cache = new Map([['alice', profile]]);
  injectLocationUIForUser('alice', '123', cache);
  injectLocationUIForUser('alice', '123', cache);
  expect(document.querySelectorAll('.threads-friendships-location-badge')).toHaveLength(1);
});
