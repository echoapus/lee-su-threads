// Background service worker for Threads Profile Info Extractor

import { browserAPI } from './lib/browserAPI.js';

import { USER_ID_CACHE_MAX_AGE, PROFILE_WITH_LOCATION_MAX_AGE, PROFILE_NO_LOCATION_MAX_AGE } from './lib/cachePolicy.js';

// Handle async message responses for both Chrome and Firefox
async function handleAsyncMessage(message) {
  if (message.type === 'PROFILE_INFO_EXTRACTED') {
    console.log('[Threads Extractor] Profile info received:', message.data);

    // Store the profile info
    const result = await browserAPI.storage.local.get(['profileCache']);
    const cache = result.profileCache || {};
    const username = message.data.username;
    if (username) {
      cache[username] = {
        ...message.data,
        timestamp: Date.now()
      };
      await browserAPI.storage.local.set({ profileCache: cache });
    }
    return;
  }

  if (message.type === 'GET_CACHED_PROFILES') {
    const result = await browserAPI.storage.local.get(['profileCache']);
    const cache = result.profileCache || {};
    const now = Date.now();
    const validCache = {};

    // Filter out expired entries based on different TTLs
    for (const [username, data] of Object.entries(cache)) {
      const maxAge = data.location ? PROFILE_WITH_LOCATION_MAX_AGE : PROFILE_NO_LOCATION_MAX_AGE;
      if (now - data.timestamp < maxAge) {
        validCache[username] = data;
      }
    }

    return validCache;
  }

  // Store user ID mappings (username -> userId)
  if (message.type === 'STORE_USER_IDS') {
    const userIds = message.data; // { username: userId, ... }
    const result = await browserAPI.storage.local.get(['userIdCache']);
    const cache = result.userIdCache || {};
    const now = Date.now();
    for (const [username, userId] of Object.entries(userIds)) {
      cache[username] = { userId, timestamp: now };
    }
    await browserAPI.storage.local.set({ userIdCache: cache });
    return;
  }

  // Get cached user IDs
  if (message.type === 'GET_USER_ID_CACHE') {
    const result = await browserAPI.storage.local.get(['userIdCache']);
    const now = Date.now();
    return Object.fromEntries(Object.entries(result.userIdCache || {}).filter(
      ([, data]) => now - data.timestamp < USER_ID_CACHE_MAX_AGE
    ));
  }

  return false;
}

// All reads, writes and cleanup share one queue so updates cannot overwrite each other.
let storageQueue = Promise.resolve();
function enqueueStorage(task) {
  const result = storageQueue.then(task);
  storageQueue = result.catch(error => {
    console.error('[Threads Extractor] Cache operation failed:', error);
  });
  return result;
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!['PROFILE_INFO_EXTRACTED', 'GET_CACHED_PROFILES', 'STORE_USER_IDS', 'GET_USER_ID_CACHE'].includes(message.type)) return false;
  enqueueStorage(() => handleAsyncMessage(message)).then(
    result => sendResponse(result ?? null),
    () => sendResponse(null)
  );
  return true;
});

browserAPI.runtime.onStartup.addListener(() => {
  enqueueStorage(async () => {
    const profileCache = await handleAsyncMessage({ type: 'GET_CACHED_PROFILES' });
    const userIdCache = await handleAsyncMessage({ type: 'GET_USER_ID_CACHE' });
    await browserAPI.storage.local.set({ profileCache, userIdCache });
  });
});
