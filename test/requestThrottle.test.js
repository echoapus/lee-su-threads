import { describe, it, expect, vi, afterEach } from 'vitest';
import { createThrottle } from '../src/lib/requestThrottle.js';

describe('createThrottle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces dispatches at least minIntervalMs apart', async () => {
    vi.useFakeTimers();
    const dispatchedAt = [];
    const fn = vi.fn(async (x) => {
      dispatchedAt.push(Date.now());
      return x;
    });
    const throttled = createThrottle(fn, 100);

    const results = Promise.all([throttled('a'), throttled('b'), throttled('c')]);
    await vi.runAllTimersAsync();

    expect(await results).toEqual(['a', 'b', 'c']);
    expect(dispatchedAt[1] - dispatchedAt[0]).toBeGreaterThanOrEqual(100);
    expect(dispatchedAt[2] - dispatchedAt[1]).toBeGreaterThanOrEqual(100);
  });

  it('keeps later calls going after an earlier call rejects', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    const throttled = createThrottle(fn, 50);

    const p1 = throttled().catch((e) => e.message);
    const p2 = throttled();
    await vi.runAllTimersAsync();

    expect(await p1).toBe('boom');
    expect(await p2).toBe('ok');
  });
});
