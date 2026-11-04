/**
 * Serialize calls to an async function with a minimum delay between
 * dispatches, no matter how many callers invoke it concurrently.
 */

/**
 * @param {Function} fn - async function to throttle
 * @param {number} minIntervalMs - minimum time between dispatches
 * @param {Function} now - clock function (injectable for tests)
 * @returns {Function} throttled version of fn, same signature, returns a Promise
 */
export function createThrottle(fn, minIntervalMs, now = Date.now) {
  let lastDispatchedAt = 0;
  let queueTail = Promise.resolve();

  return function throttled(...args) {
    const run = queueTail.then(async () => {
      const wait = lastDispatchedAt + minIntervalMs - now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastDispatchedAt = now();
      return fn(...args);
    });
    // Keep the queue moving even if this call fails, so it can't jam later ones
    queueTail = run.catch(() => {});
    return run;
  };
}
