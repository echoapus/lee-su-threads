import { it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('keeps same-author visibility timers independent and unobserves queued buttons', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('chrome', { i18n: { getMessage: () => '' } });
  let notify;
  const unobserve = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { notify = callback; }
    unobserve = unobserve;
  });
  const { createFeedVisibilityObserver } = await import('../src/lib/autoFetchObservers.js');
  const queue = vi.fn();
  const pending = new Map();
  createFeedVisibilityObserver(queue, pending, new Map(), {}, 500);
  const first = { getAttribute: () => 'alice' };
  const second = { getAttribute: () => 'alice' };
  notify([{ target: first, isIntersecting: true }, { target: second, isIntersecting: true }]);
  notify([{ target: first, isIntersecting: false }]);
  await vi.advanceTimersByTimeAsync(500);
  expect(queue).toHaveBeenCalledExactlyOnceWith('alice', second);
  expect(unobserve).toHaveBeenCalledWith(second);
  expect(pending.size).toBe(0);
});
