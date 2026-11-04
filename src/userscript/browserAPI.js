import en from '../../_locales/en/messages.json';
import flagFont from '../../fonts/TwemojiCountryFlags.woff2';
import { USER_ID_CACHE_MAX_AGE, PROFILE_WITH_LOCATION_MAX_AGE, PROFILE_NO_LOCATION_MAX_AGE } from '../lib/cachePolicy.js';

function readCache(prefix) {
  const cache = {};
  const now = Date.now();
  for (const key of GM_listValues()) {
    if (!key.startsWith(prefix)) continue;
    const data = GM_getValue(key);
    const maxAge = prefix === 'userId:' ? USER_ID_CACHE_MAX_AGE
      : data?.location ? PROFILE_WITH_LOCATION_MAX_AGE : PROFILE_NO_LOCATION_MAX_AGE;
    if (data && now - data.timestamp < maxAge) {
      cache[key.slice(prefix.length)] = data;
    } else {
      GM_deleteValue(key);
    }
  }
  return cache;
}

async function sendMessage({ type, data }) {
  // Separate keys keep simultaneous writes from different tabs from losing other accounts.
  if (type === 'PROFILE_INFO_EXTRACTED' && data?.username) {
    GM_setValue(`profile:${data.username}`, { ...data, timestamp: Date.now() });
  } else if (type === 'STORE_USER_IDS') {
    for (const [username, userId] of Object.entries(data)) {
      GM_setValue(`userId:${username}`, { userId, timestamp: Date.now() });
    }
  } else if (type === 'GET_CACHED_PROFILES') {
    return readCache('profile:');
  } else if (type === 'GET_USER_ID_CACHE') {
    return readCache('userId:');
  }
  return null;
}

export const browserAPI = {
  i18n: { getMessage: key => en[key]?.message || '' },
  runtime: { getURL: () => flagFont, sendMessage }
};

// The userscript entry installs the interceptor before loading the shared content code.
export function injectScript() {}
