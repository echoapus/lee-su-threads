import { it, expect, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

let dom;
afterEach(() => { dom?.window.close(); vi.unstubAllGlobals(); vi.resetModules(); });

it('returns responses before inspection finishes, skips unrelated bodies, and refreshes IDs', async () => {
  dom = new JSDOM('', { url: 'https://www.threads.com' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('XMLHttpRequest', dom.window.XMLHttpRequest);
  vi.stubGlobal('CustomEvent', dom.window.CustomEvent);
  let finish;
  const text = new Promise(resolve => { finish = resolve; });
  const response = { clone: vi.fn(() => ({ text: () => text })) };
  dom.window.fetch = vi.fn(async () => response);
  await import('../src/injected.js');
  expect(await dom.window.fetch('/graphql/query')).toBe(response);
  expect(response.clone).toHaveBeenCalledTimes(1);
  response.clone.mockClear();
  await dom.window.fetch('/video');
  expect(response.clone).not.toHaveBeenCalled();
  dom.window.__threadsUserIdMap.set('alice', '1');
  finish(JSON.stringify({ user: { username: 'alice', pk: '2' } }));
  await vi.waitFor(() => expect(dom.window.__threadsUserIdMap.get('alice')).toBe('2'));
});
