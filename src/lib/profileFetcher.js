/**
 * Shared utility functions for fetching profile data and user IDs
 */

// A completed or timed-out request releases both its listener and timer.
function requestFromPage(type, data, responseKey, timeoutMs) {
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  let timer;
  return new Promise((resolve, reject) => {
    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type === `${type}-response` && event.data.requestId === requestId) {
        resolve(event.data[responseKey]);
      }
    }, { signal: controller.signal });
    timer = setTimeout(() => resolve(null), timeoutMs);
    try {
      window.postMessage({ type: `${type}-request`, requestId, ...data }, window.location.origin);
    } catch (error) {
      reject(error);
    }
  }).finally(() => {
    clearTimeout(timer);
    controller.abort();
  });
}

const pendingProfiles = new Map();

/** Fetch a profile, sharing concurrent requests with the same timeout. */
export function fetchProfileByUserId(userId, timeoutMs = 10000) {
  const key = `${userId}:${timeoutMs}`;
  if (!pendingProfiles.has(key)) {
    pendingProfiles.set(key,
      requestFromPage('threads-fetch', { userId }, 'result', timeoutMs)
        .finally(() => pendingProfiles.delete(key))
    );
  }
  return pendingProfiles.get(key);
}

/** Look up a username in the page's captured ID map. */
export function getUserIdByUsername(username, timeoutMs = 2000) {
  return requestFromPage('threads-userid', { username }, 'userId', timeoutMs);
}

/**
 * Update button with fetch result - replace with badge or show error state
 * @param {HTMLButtonElement} btn - The button element to update
 * @param {string} username - Username (without @)
 * @param {Object|null} profileInfo - Profile info object or null if failed
 * @param {Map} profileCache - Cache to store profile data
 * @param {Function} createBadgeFunc - Function to create badge element
 * @returns {void}
 */
export function updateButtonWithFetchResult(btn, username, profileInfo, profileCache, createBadgeFunc) {
  if (profileInfo && !profileInfo._rateLimited && !profileInfo._loginRequired) {
    profileCache.set(username, profileInfo);

    // Replace button with badge
    if (profileInfo.location) {
      const badge = createBadgeFunc(profileInfo);
      btn.replaceWith(badge);
    } else {
      // No location data
      btn.textContent = '➖';
      btn.title = 'No location available';
      btn.disabled = true;
      btn.style.cursor = 'default';
      btn.style.opacity = '0.4';
    }
  } else if (profileInfo?._rateLimited) {
    btn.textContent = '⏸';
    btn.title = 'Rate limited. Try again later.';
    btn.disabled = false;
  } else if (profileInfo?._loginRequired) {
    btn.textContent = '🔒';
    btn.title = 'Login required. Click to learn more.';
    btn.disabled = false;
    btn.setAttribute('data-login-required', 'true');
  } else {
    btn.textContent = '🔄';
    btn.title = 'Failed. Click to retry.';
    btn.disabled = false;
  }
}
