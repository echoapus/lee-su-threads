import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { fetchProfileByUserId, getUserIdByUsername } from '../src/lib/profileFetcher.js';

let dom, post, signal;
beforeEach(() => {
  vi.useFakeTimers();
  dom = new JSDOM('', { url: 'https://www.threads.com' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('AbortController', dom.window.AbortController);
  post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
    signal = options.signal;
    add(type, handler, options);
  });
});
afterEach(() => {
  dom.window.close();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function respond(data, source = window, origin = window.location.origin) {
  window.dispatchEvent(new dom.window.MessageEvent('message', { data, source, origin }));
}

it('shares simultaneous profile requests and releases resources on success', async () => {
  const first = fetchProfileByUserId('123');
  const second = fetchProfileByUserId('123');
  expect(first).toBe(second);
  expect(post).toHaveBeenCalledTimes(1);
  const [request, origin] = post.mock.calls[0];
  expect(origin).toBe(window.location.origin);
  const result = { username: 'alice', location: 'Taiwan' };
  respond({ type: 'threads-fetch-response', requestId: request.requestId, result });
  expect(await first).toEqual(result);
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  const next = fetchProfileByUserId('123', 1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await next).toBeNull();
  expect(post).toHaveBeenCalledTimes(2);
});

it('ignores responses from other windows, origins and request IDs', async () => {
  const result = getUserIdByUsername('alice', 20);
  const requestId = post.mock.calls[0][0].requestId;
  const data = { type: 'threads-userid-response', requestId, userId: '123' };
  respond(data, null);
  respond(data, window, 'https://example.com');
  respond({ ...data, requestId: 'different' });
  await vi.advanceTimersByTimeAsync(20);
  expect(await result).toBeNull();
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps caller timeouts independent and allows retry after timeout', async () => {
  const short = fetchProfileByUserId('456', 10);
  const long = fetchProfileByUserId('456', 100);
  expect(post).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(10);
  expect(await short).toBeNull();
  const request = post.mock.calls[1][0];
  respond({ type: 'threads-fetch-response', requestId: request.requestId, result: { username: 'bob' } });
  expect(await long).toEqual({ username: 'bob' });
  const retry = fetchProfileByUserId('456', 10);
  expect(post).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(10);
  expect(await retry).toBeNull();
});

it('cleans up after a postMessage failure and permits another attempt', async () => {
  post.mockImplementationOnce(() => { throw new Error('message failed'); });
  await expect(fetchProfileByUserId('789')).rejects.toThrow('message failed');
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  const retry = fetchProfileByUserId('789', 1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await retry).toBeNull();
});
