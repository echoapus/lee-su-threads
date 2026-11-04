/**
 * IntersectionObserver for auto-fetching feed post profiles on scroll
 */

import { browserAPI } from './browserAPI.js';

/**
 * Create IntersectionObserver for feed posts
 * @param {Function} queueFeedFetch - Function to queue feed fetches
 * @param {Map} pendingVisibility - Map tracking pending visibility timers
 * @param {Map} profileCache - Profile cache
 * @param {Object} state - State object with isUserLoggedIn flag
 * @param {number} visibilityDelayMs - Delay before queuing
 * @returns {IntersectionObserver}
 */
export function createFeedVisibilityObserver(queueFeedFetch, pendingVisibility, profileCache, state, visibilityDelayMs) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const btn = entry.target;
      const username = btn.getAttribute('data-username');
      if (!username) return;

      if (entry.isIntersecting) {
        // Skip auto-fetch if user is logged out
        if (state.isUserLoggedIn === false) {
          // Mark button as login-required without fetching
          btn.textContent = '🔒';
          btn.title = browserAPI.i18n.getMessage('loginRequired') || 'Login required. Click to learn more.';
          btn.setAttribute('data-login-required', 'true');
          observer.unobserve(btn);
          return;
        }

        // Post entered viewport - start delay timer
        if (!pendingVisibility.has(btn) && !profileCache.has(username)) {
          const timeoutId = setTimeout(() => {
            // Still visible after delay? Queue it
            if (pendingVisibility.has(btn)) {
              pendingVisibility.delete(btn);
              queueFeedFetch(username, btn);
              observer.unobserve(btn);
            }
          }, visibilityDelayMs);
          pendingVisibility.set(btn, timeoutId);
        }
      } else {
        // Post left viewport - cancel pending timer
        if (pendingVisibility.has(btn)) {
          clearTimeout(pendingVisibility.get(btn));
          pendingVisibility.delete(btn);
        }
      }
    });
  }, { threshold: 0.1 });
  return observer;
}
