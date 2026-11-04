/**
 * Queue management for auto-fetching feed post profiles, with throttling and rate limiting
 */

import { displayProfileInfo, autoFetchProfile } from './postUI.js';

/**
 * Add a username to the auto-fetch queue
 * @param {string} username - Username to queue
 * @param {HTMLElement} btn - Button element
 * @param {Array} queue - Queue array to add to
 * @param {IntersectionObserver} observer - Observer to re-observe removed items
 * @param {Function} processFunc - Function to call to process the queue
 * @param {boolean} shouldProcess - Whether to start processing immediately
 * @param {Map} profileCache - Profile cache
 * @param {number} maxQueueSize - Maximum queue size
 */
export function queueFetch(username, btn, queue, observer, processFunc, shouldProcess, profileCache, maxQueueSize) {
  // Don't queue if already cached
  if (profileCache.has(username)) return;

  // Check if already in queue
  const existingIndex = queue.findIndex(item => item.username === username);
  if (existingIndex !== -1) {
    // Already in queue - move to front (prioritize recently visible)
    const existing = queue.splice(existingIndex, 1)[0];
    queue.unshift(existing);
    return;
  }

  // Add to front of queue (newest visible items get priority)
  queue.unshift({ username, btn });

  // Trim queue if it exceeds max size (remove oldest items from the back)
  while (queue.length > maxQueueSize) {
    const removed = queue.pop();
    // Re-observe removed items so they can be re-queued if scrolled back
    if (removed && removed.btn && observer) {
      observer.observe(removed.btn);
    }
  }

  // Start processing if conditions are met
  if (shouldProcess) {
    processFunc();
  }
}

/**
 * Process the feed fetch queue with throttling
 * @param {Array} fetchQueue - Feed queue array
 * @param {Object} state - State object containing flags and settings
 * @param {Map} profileCache - Profile cache
 * @param {number} fetchDelayMs - Delay between fetches
 */
export async function processFetchQueue(fetchQueue, state, profileCache, fetchDelayMs) {
  if (state.isFetching || fetchQueue.length === 0) return;

  // Check if rate limited
  if (Date.now() < state.rateLimitedUntil) {
    console.log('[Threads Extractor] Rate limit cooldown active. Skipping queue processing.');
    return;
  }

  state.isFetching = true;

  while (fetchQueue.length > 0) {
    // Stop processing if user is logged out
    if (state.isUserLoggedIn === false) {
      console.log('[Threads Extractor] User logged out. Stopping queue processing.');
      fetchQueue.length = 0; // Clear the queue
      break;
    }

    // Check rate limit before each fetch
    if (Date.now() < state.rateLimitedUntil) {
      console.log('[Threads Extractor] Rate limit triggered. Stopping queue processing.');
      break;
    }

    const { username, btn } = fetchQueue.shift();
    console.log(`[Threads Extractor] Processing @${username}, queue length: ${fetchQueue.length}`);

    // Skip if already fetched while in queue
    if (profileCache.has(username)) {
      const cached = profileCache.get(username);
      displayProfileInfo(cached);
      btn.style.display = 'none';
      continue;
    }

    btn.textContent = '⏳';
    await autoFetchProfile(username, btn, profileCache);

    // Throttle: wait before next fetch
    if (fetchQueue.length > 0) {
      await new Promise(r => setTimeout(r, fetchDelayMs));
    }
  }

  state.isFetching = false;
}
