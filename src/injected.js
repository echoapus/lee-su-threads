// Injected script to intercept fetch/XHR responses for profile data
import { parseProfileResponse } from './lib/profileParser.js';
import { createThrottle } from './lib/requestThrottle.js';

'use strict';

// Note: Font polyfill is loaded by content.js (same document, different context)
// No need to load it again here

// ========== SESSION TOKENS ==========
let sessionTokens = null;
let lastLoginState = null; // Track login state to detect changes

function isLoggedIn() {
  if (!sessionTokens) return false;
  if (!sessionTokens.fb_dtsg) return false;
  if (!sessionTokens.__user || sessionTokens.__user === '0') return false;
  return true;
}

function broadcastLoginState() {
  const currentState = isLoggedIn();
  if (currentState !== lastLoginState) {
    lastLoginState = currentState;
    window.postMessage({ type: 'threads-login-state', isLoggedIn: currentState }, '*');
    console.log(`%c[Threads Extractor] Login state: ${currentState ? 'LOGGED IN' : 'LOGGED OUT'}`, 'color: #3b82f6; font-weight: bold;');
  }
}

function captureSessionTokens(bodyParsed) {
  if (bodyParsed && bodyParsed.fb_dtsg) {
    // Preserve existing __user if the captured one is '0' (not logged in indicator)
    const preservedUser = (bodyParsed.__user && bodyParsed.__user !== '0')
      ? bodyParsed.__user
      : (sessionTokens?.__user || '0');

    sessionTokens = {
      fb_dtsg: bodyParsed.fb_dtsg,
      lsd: bodyParsed.lsd,
      jazoest: bodyParsed.jazoest,
      __user: preservedUser,
      __a: bodyParsed.__a,
      __hs: bodyParsed.__hs,
      __dyn: bodyParsed.__dyn,
      __csr: bodyParsed.__csr,
      __comet_req: bodyParsed.__comet_req,
      __ccg: bodyParsed.__ccg,
      __rev: bodyParsed.__rev,
      __s: bodyParsed.__s,
      __hsi: bodyParsed.__hsi,
      __spin_r: bodyParsed.__spin_r,
      __spin_b: bodyParsed.__spin_b,
      __spin_t: bodyParsed.__spin_t,
      dpr: bodyParsed.dpr,
      __d: bodyParsed.__d
    };

    console.log('%c[Threads Extractor] Session tokens captured!', 'color: #10b981; font-weight: bold;');

    window.__threadsExtractorTokens = sessionTokens;
    broadcastLoginState();
  }
}

// ========== USER ID MAPPING ==========
const userIdMap = new Map();
window.__threadsUserIdMap = userIdMap;
let pendingNewUserIds = {}; // Buffer for new discoveries to broadcast

// Listen for cached user IDs from content script
window.addEventListener('message', (event) => {
  if (event.data?.type === 'threads-load-userid-cache') {
    const cachedUserIds = event.data.data;
    let loadedCount = 0;
    for (const [username, userId] of Object.entries(cachedUserIds)) {
      if (!userIdMap.has(username)) {
        userIdMap.set(username, userId);
        loadedCount++;
      }
    }
    if (loadedCount > 0) {
      console.log(`%c[Threads Extractor] Loaded ${loadedCount} user IDs from cache`, 'color: #22c55e; font-weight: bold;');
    }
  }
});

// Broadcast new user IDs to content script (debounced)
let broadcastTimeout = null;
function broadcastNewUserIds() {
  if (broadcastTimeout) clearTimeout(broadcastTimeout);
  broadcastTimeout = setTimeout(() => {
    if (Object.keys(pendingNewUserIds).length > 0) {
      window.postMessage({ type: 'threads-new-user-ids', data: pendingNewUserIds }, '*');
      pendingNewUserIds = {};
    }
  }, 1000); // Debounce 1 second
}

// Helper to add user ID and queue for persistence
function addUserId(username, userId, source = '') {
  if (!userIdMap.has(username)) {
    userIdMap.set(username, userId);
    pendingNewUserIds[username] = userId;
    broadcastNewUserIds();
    if (source) {
      console.log(`%c[Threads Extractor] Found user (${source}): @${username} -> ${userId}`, 'color: #f59e0b;');
    }
    return true;
  }
  return false;
}

function extractUserIds(obj, source = 'unknown') {
  if (!obj || typeof obj !== 'object') return;

  // Look for user objects with id and username
  if (obj.id && obj.username) {
    const userId = String(obj.id);
    const username = String(obj.username);
    if (userId.match(/^\d+$/) && username.match(/^[\w.]+$/)) {
      addUserId(username, userId, 'id');
    }
  }

  // Check for pk (primary key) - can be string or number
  if (obj.pk && obj.username) {
    const userId = String(obj.pk);
    const username = String(obj.username);
    if (userId.match(/^\d+$/) && username.match(/^[\w.]+$/)) {
      addUserId(username, userId, 'pk');
    }
  }

  // Check for nested user object
  if (obj.user && typeof obj.user === 'object') {
    const user = obj.user;
    const userId = String(user.pk || user.id || '');
    const username = String(user.username || '');
    if (userId.match(/^\d+$/) && username.match(/^[\w.]+$/)) {
      addUserId(username, userId, 'nested');
    }
  }

  // Recurse
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      value.forEach(item => extractUserIds(item, source));
    } else if (typeof value === 'object' && value !== null) {
      extractUserIds(value, source);
    }
  }
}

// ========== PARSE PROFILE RESPONSE ==========
// parseProfileResponse is imported from lib/profileParser.js

// ========== SHARED RESPONSE PARSERS (fetch + XHR) ==========
function handleBulkRouteDefinitions(data) {
  if (!data.payload?.payloads) return;
  const beforeCount = userIdMap.size;
  for (const [routeKey, routeData] of Object.entries(data.payload.payloads)) {
    // routeKey is like "/@username" (may be unicode escaped)
    let decodedKey = routeKey;
    try {
      decodedKey = JSON.parse(`"${routeKey}"`);
    } catch (e) {}

    const usernameMatch = decodedKey.match(/^\/@([\w.]+)/);
    if (usernameMatch) {
      const username = usernameMatch[1];
      const userId = routeData.result?.exports?.rootView?.props?.user_id
                  || routeData.result?.exports?.hostableView?.props?.user_id;
      if (userId) {
        addUserId(username, String(userId), 'route');
      }
    }
  }
  const afterCount = userIdMap.size;
  if (afterCount > beforeCount) {
    console.log(`%c[Threads Extractor] 🎯 bulk-route-definitions: Found ${afterCount - beforeCount} NEW user(s)`, 'color: #22c55e; font-weight: bold;');
  }
}

function handleFriendshipsEdges(data) {
  const edges =
    data.data?.xdt_text_app_user?.follower_users?.edges ||
    data.data?.xdt_text_app_user?.following_users?.edges ||
    data.data?.user?.followers?.edges ||
    data.data?.user?.following?.edges ||
    [];

  if (edges.length > 0) {
    console.log(`%c[Threads Extractor] Found ${edges.length} users in list`, 'color: #3b82f6;');
    window.dispatchEvent(new CustomEvent('threads-friendships-list-loaded', {
      detail: {
        users: edges.map(edge => ({
          pk: edge.node.pk,
          username: edge.node.username,
          full_name: edge.node.full_name
        }))
      }
    }));
  } else {
    console.log('%c[Threads Extractor] ⚠️ Matched followers/following query but no edges found', 'color: #f59e0b;');
    console.log('Response data structure:', data);
  }
}

// ========== FETCH INTERCEPTOR ==========
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const url = args[0]?.url || args[0];
  const options = args[1] || {};

  // Extract friendly name from headers for GraphQL queries
  let friendlyName = null;
  if (options.headers) {
    const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers || {});
    friendlyName = headers.get('x-fb-friendly-name');
  }

  // Capture session tokens
  if (options.body) {
    try {
      let bodyParsed = null;
      if (options.body instanceof URLSearchParams) {
        bodyParsed = Object.fromEntries(options.body.entries());
      } else if (typeof options.body === 'string' && !options.body.startsWith('{')) {
        bodyParsed = Object.fromEntries(new URLSearchParams(options.body).entries());
      }
      if (bodyParsed) {
        captureSessionTokens(bodyParsed);
      }
    } catch (e) { /* ignore */ }
  }

  // Log interesting requests (reduced logging, only for about_this_profile)
  if (typeof url === 'string' && url.includes('about_this_profile')) {
    console.group(`%c[Threads Extractor] 🔍 API Request: ${url.substring(0, 100)}...`, 'color: #3b82f6; font-weight: bold;');
    console.log('%cFull URL:', 'color: #10b981;', url);
    console.groupEnd();
  }

  const response = await originalFetch.apply(this, args);

  // Extract user IDs from responses
  if (typeof url === 'string') {
    try {
      const clone = response.clone();
      const text = await clone.text();
      let jsonStr = text;
      if (jsonStr.startsWith('for (;;);')) {
        jsonStr = jsonStr.substring(9);
      }
      if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
        const data = JSON.parse(jsonStr);

        // Special handling for bulk-route-definitions - this is the goldmine!
        if (url.includes('bulk-route-definitions')) {
          console.log('%c[Threads Extractor] 🎯 Intercepted bulk-route-definitions!', 'color: #f59e0b; font-weight: bold;');
          handleBulkRouteDefinitions(data);
        }

        // Special handling for Followers/Following GraphQL queries
        // Check by friendly name (from headers) or data structure
        const isFriendshipsQuery = friendlyName === 'BarcelonaFriendshipsDialogUserQuery' ||
                                   friendlyName === 'BarcelonaFriendshipsFollowersTabQuery' ||
                                   friendlyName === 'BarcelonaFriendshipsFollowingTabQuery' ||
                                   url.includes('BarcelonaFriendshipsDialogUserQuery') ||
                                   url.includes('BarcelonaFriendshipsFollowersTabQuery') ||
                                   url.includes('BarcelonaFriendshipsFollowingTabQuery');

        if (url.includes('graphql/query') && isFriendshipsQuery) {
          console.log('%c[Threads Extractor] 📋 Intercepted Followers/Following dialog!', 'color: #3b82f6; font-weight: bold;');
          console.log('  Friendly name:', friendlyName);
          handleFriendshipsEdges(data);
        }

        const beforeCount = userIdMap.size;
        extractUserIds(data, url);
        const afterCount = userIdMap.size;
        if (afterCount > beforeCount) {
          console.log(`%c[Threads Extractor] 👤 Found ${afterCount - beforeCount} NEW user(s) in response`, 'color: #22c55e; font-weight: bold;');
        }
      }
    } catch (e) { /* not JSON */ }
  }

  if (typeof url === 'string' && url.includes('about_this_profile_async_action')) {
    try {
      const clone = response.clone();
      const text = await clone.text();
      const profileInfo = parseProfileResponse(text);
      if (profileInfo && profileInfo.username) {
        delete profileInfo._pairs;
        delete profileInfo._currentLabel;
        delete profileInfo._pairsProcessed;
        console.log('[Threads Extractor] Extracted profile info:', profileInfo);
        window.dispatchEvent(new CustomEvent('threads-profile-extracted', { detail: profileInfo }));
      }
    } catch (e) {
      console.error('[Threads Extractor] Error processing response:', e);
    }
  }

  return response;
};

// ========== XHR INTERCEPTOR ==========
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  this._threadsUrl = url;
  this._threadsMethod = method;
  this._threadsHeaders = {};
  return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
  if (this._threadsHeaders) {
    this._threadsHeaders[name] = value;
  }
  return originalXHRSetRequestHeader.apply(this, [name, value]);
};

XMLHttpRequest.prototype.send = function(...args) {
  const xhrUrl = this._threadsUrl;
  const xhrHeaders = this._threadsHeaders || {};
  const requestBody = args[0];

  // Handle bulk-route-definitions via XHR
  if (xhrUrl && xhrUrl.includes('bulk-route-definitions')) {
    this.addEventListener('load', function() {
      try {
        console.log('%c[Threads Extractor] 🎯 Intercepted bulk-route-definitions (XHR)!', 'color: #f59e0b; font-weight: bold;');
        let jsonStr = this.responseText;
        if (jsonStr.startsWith('for (;;);')) {
          jsonStr = jsonStr.substring(9);
        }
        const data = JSON.parse(jsonStr);
        handleBulkRouteDefinitions(data);
      } catch (e) {
        console.error('[Threads Extractor] Error processing bulk-route-definitions:', e);
      }
    });
  }

  // Handle GraphQL Followers/Following queries via XHR
  // Check both headers and request body for the friendly name
  let friendlyName = xhrHeaders['x-fb-friendly-name'];

  // If not in headers, check request body
  if (!friendlyName && requestBody && typeof requestBody === 'string') {
    const bodyMatch = requestBody.match(/fb_api_req_friendly_name=([^&]+)/);
    if (bodyMatch) {
      friendlyName = decodeURIComponent(bodyMatch[1]);
    }
  }

  const isFriendshipsQuery = friendlyName === 'BarcelonaFriendshipsDialogUserQuery' ||
                             friendlyName === 'BarcelonaFriendshipsFollowersTabQuery' ||
                             friendlyName === 'BarcelonaFriendshipsFollowingTabQuery';

  if (xhrUrl && xhrUrl.includes('graphql/query') && isFriendshipsQuery) {
    this.addEventListener('load', function() {
      try {
        console.log('%c[Threads Extractor] 📋 Intercepted Followers/Following dialog (XHR)!', 'color: #3b82f6; font-weight: bold;');
        console.log('  Friendly name:', friendlyName);

        let jsonStr = this.responseText;
        if (jsonStr.startsWith('for (;;);')) {
          jsonStr = jsonStr.substring(9);
        }
        const data = JSON.parse(jsonStr);
        handleFriendshipsEdges(data);
      } catch (e) {
        console.error('[Threads Extractor] Error processing GraphQL followers/following response:', e);
      }
    });
  }

  // Handle about_this_profile
  if (xhrUrl && xhrUrl.includes('about_this_profile_async_action')) {
    this.addEventListener('load', function() {
      try {
        const profileInfo = parseProfileResponse(this.responseText);
        if (profileInfo && profileInfo.username) {
          delete profileInfo._pairs;
          delete profileInfo._currentLabel;
          delete profileInfo._pairsProcessed;
          console.log('[Threads Extractor] Extracted profile info (XHR):', profileInfo);
          window.dispatchEvent(new CustomEvent('threads-profile-extracted', { detail: profileInfo }));
        }
      } catch (e) {
        console.error('[Threads Extractor] Error processing XHR response:', e);
      }
    });
  }
  return originalXHRSend.apply(this, args);
};

// ========== FETCH PROFILE INFO ==========
async function fetchProfileInfo(targetUserId) {
  if (!isLoggedIn()) {
    console.warn('[Threads Extractor] User is not logged in. Cannot fetch profile info.');
    return { _loginRequired: true };
  }

  const url = '/async/wbloks/fetch/?appid=com.bloks.www.text_post_app.about_this_profile_async_action&type=app&__bkv=22713cafbb647b89c4e9c1acdea97d89c8c2046e2f4b18729760e9b1ae0724f7';

  const params = new URLSearchParams();
  params.append('__user', '0');  // Always send 0 - auth comes from cookies, not __user param
  params.append('__a', sessionTokens.__a || '1');
  params.append('__req', 'ext_' + crypto.randomUUID());
  params.append('__hs', sessionTokens.__hs || '');
  params.append('dpr', sessionTokens.dpr || '2');
  params.append('__ccg', sessionTokens.__ccg || 'UNKNOWN');
  params.append('__rev', sessionTokens.__rev || '');
  params.append('__s', sessionTokens.__s || '');
  params.append('__hsi', sessionTokens.__hsi || '');
  params.append('__dyn', sessionTokens.__dyn || '');
  params.append('__csr', sessionTokens.__csr || '');
  params.append('__comet_req', sessionTokens.__comet_req || '29');
  params.append('fb_dtsg', sessionTokens.fb_dtsg || '');
  params.append('jazoest', sessionTokens.jazoest || '');
  params.append('lsd', sessionTokens.lsd || '');
  params.append('__spin_r', sessionTokens.__spin_r || '');
  params.append('__spin_b', sessionTokens.__spin_b || 'trunk');
  params.append('__spin_t', sessionTokens.__spin_t || '');
  params.append('params', JSON.stringify({
    atpTriggerSessionID: crypto.randomUUID(),
    referer_type: 'TextPostAppProfileOverflow',
    target_user_id: String(targetUserId)
  }));
  params.append('__d', sessionTokens.__d || 'www');

  console.log('[Threads Extractor] Fetching profile info for user ID:', targetUserId);
  if (!sessionTokens.fb_dtsg) {
    console.warn('[Threads Extractor] Warning: fb_dtsg token missing, request may fail');
  }

  try {
    const response = await originalFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-FB-Friendly-Name': 'BarcelonaProfileAboutThisProfileAsyncActionQuery'
      },
      body: params,
      credentials: 'include'
    });

    // Check for rate limiting
    if (response.status === 429) {
      console.warn('[Threads Extractor] ⚠️ Rate limited (429)! Notifying content script...');
      window.dispatchEvent(new CustomEvent('threads-rate-limited'));
      return { _rateLimited: true };
    }

    const text = await response.text();

    const profileInfo = parseProfileResponse(text);
    console.log('[Threads Extractor] Parsed profile info:', profileInfo);

    // If we got profile data but no username, use the target user ID to look up username
    if (profileInfo && !profileInfo.username) {
      // Find username from our map by user ID
      for (const [uname, uid] of userIdMap.entries()) {
        if (uid === String(targetUserId)) {
          profileInfo.username = uname;
          console.log(`[Threads Extractor] Resolved username from map: @${uname}`);
          break;
        }
      }
    }

    if (profileInfo && (profileInfo.username || profileInfo.joined || profileInfo.location)) {
      delete profileInfo._pairs;
      delete profileInfo._currentLabel;
      delete profileInfo._pairsProcessed;
      // If still no username, mark it with the user ID
      if (!profileInfo.username) {
        profileInfo.username = `user_${targetUserId}`;
        profileInfo._userIdOnly = true;
      }
      console.log('[Threads Extractor] Fetched profile info:', profileInfo);
      window.dispatchEvent(new CustomEvent('threads-profile-extracted', { detail: profileInfo }));
      return profileInfo;
    } else {
      console.warn('[Threads Extractor] Could not extract profile info from response. Raw profileInfo:', profileInfo);
    }
  } catch (e) {
    console.error('[Threads Extractor] Error fetching profile info:', e);
  }

  return null;
}

// ========== RATE LIMITING ==========
// Every profile fetch funnels through here regardless of where it came from
// (auto-scroll queue, a manual 📍 click on a feed post, a manual click in the
// followers/following list) - throttling this one choke point covers all of
// them instead of rate-limiting each caller separately.
const throttledFetchProfileInfo = createThrottle(fetchProfileInfo, 800);

// ========== SCAN PAGE FOR SESSION TOKENS ==========
function scanPageForSessionTokens() {
  console.log('%c[Threads Extractor] 🔑 Scanning page for session tokens...', 'color: #ec4899; font-weight: bold;');

  // Look for fb_dtsg and __user in various places
  const patterns = {
    fb_dtsg: [
      /"fb_dtsg"\s*:\s*"([^"]+)"/,
      /name="fb_dtsg"\s+value="([^"]+)"/,
      /"DTSGInitialData"[^}]*"token"\s*:\s*"([^"]+)"/,
      /\["DTSGInitData",\[\],\{"token":"([^"]+)"/
    ],
    lsd: [
      /"lsd"\s*:\s*"([^"]+)"/,
      /name="lsd"\s+value="([^"]+)"/,
      /"LSD"[^}]*"token"\s*:\s*"([^"]+)"/
    ],
    jazoest: [
      /"jazoest"\s*:\s*"?(\d+)"?/,
      /name="jazoest"\s+value="(\d+)"/
    ],
    __user: [
      /"viewer"\s*:\s*\{[^}]*"id"\s*:\s*"(\d{10,})"/,  // viewer.id (most specific!)
      /"__user"\s*:\s*"?(\d{10,})"?/,  // Match 10+ digits to avoid matching '0'
      /"USER_ID"\s*:\s*"(\d{10,})"/,
      /"userID"\s*:\s*"(\d{10,})"/,
      /"viewerID"\s*:\s*"(\d{10,})"/,
      /"viewer_id"\s*:\s*"?(\d{10,})"?/,
      /"logged_in_user_id"\s*:\s*"?(\d{10,})"?/,
      /"current_user_id"\s*:\s*"?(\d{10,})"?/,
      /\["CurrentUserInitialData"[^\]]*"USER_ID"\s*:\s*"(\d{10,})"/,
      /\["CurrentUserInitialData"[^\]]*"ACCOUNT_ID"\s*:\s*"(\d{10,})"/
    ]
  };

  const foundTokens = {};

  // Scan inline script tags and input fields (much more efficient than scanning entire DOM)
  const scripts = document.querySelectorAll('script:not([src])');
  const inputs = document.querySelectorAll('input[name="fb_dtsg"], input[name="lsd"], input[name="jazoest"]');

  // Check input fields first (fastest)
  inputs.forEach((input) => {
    const name = input.getAttribute('name');
    const value = input.getAttribute('value');
    if (value && !foundTokens[name]) {
      foundTokens[name] = value;
      console.log(`%c  Found ${name} from input: ${value.substring(0, 30)}...`, 'color: #f472b6;');
    }
  });

  // Check script tags
  scripts.forEach((script) => {
    const content = script.textContent || '';

    for (const [tokenName, regexList] of Object.entries(patterns)) {
      if (foundTokens[tokenName]) continue; // Skip if already found

      for (const regex of regexList) {
        const match = content.match(regex);
        if (match) {
          foundTokens[tokenName] = match[1];
          console.log(`%c  Found ${tokenName}: ${match[1].substring(0, 30)}...`, 'color: #f472b6;');
          break;
        }
      }
    }

  });

  if (foundTokens.fb_dtsg) {
    // Merge with existing session tokens or create new
    sessionTokens = {
      ...sessionTokens,
      fb_dtsg: foundTokens.fb_dtsg,
      lsd: foundTokens.lsd || sessionTokens?.lsd || '',
      jazoest: foundTokens.jazoest || sessionTokens?.jazoest || '',
      __user: foundTokens.__user || sessionTokens?.__user || '0',
      __a: sessionTokens?.__a || '1',
      __comet_req: sessionTokens?.__comet_req || '29',
      __d: sessionTokens?.__d || 'www'
    };
    window.__threadsExtractorTokens = sessionTokens;
    console.log('%c  ✅ Session tokens updated from page!', 'color: #22c55e; font-weight: bold;');
    broadcastLoginState();
  } else {
    console.log('%c  ❌ Could not find fb_dtsg on page', 'color: #ef4444;');
    broadcastLoginState(); // Still broadcast - might be logged out
  }

  return foundTokens;
}

// ========== SCAN PAGE FOR USER IDS ==========
function scanPageForUserIds() {
  console.log('%c[Threads Extractor] 🔎 Scanning page for embedded user data...', 'color: #8b5cf6; font-weight: bold;');
  const beforeCount = userIdMap.size;

  // Check ALL script tags with type="application/json"
  const jsonScripts = document.querySelectorAll('script[type="application/json"]');
  console.log(`%c  Found ${jsonScripts.length} JSON script tags`, 'color: #a855f7;');

  jsonScripts.forEach((script, i) => {
    const content = script.textContent || '';
    if (content.includes('"pk"') || content.includes('"username"') || content.includes('"user"')) {
      try {
        const data = JSON.parse(content);
        extractUserIds(data, `json-script#${i}`);
      } catch (e) {
        // Regex fallback - look for pk and username close together
        const pkMatches = [...content.matchAll(/"pk"\s*:\s*"(\d+)"/g)];
        const usernameMatches = [...content.matchAll(/"username"\s*:\s*"([\w.]+)"/g)];

        for (const pkMatch of pkMatches) {
          const pkIndex = pkMatch.index;
          const pk = pkMatch[1];
          for (const userMatch of usernameMatches) {
            const userIndex = userMatch.index;
            const username = userMatch[1];
            if (Math.abs(userIndex - pkIndex) < 500) {
              addUserId(username, pk, 'regex');
              break;
            }
          }
        }
      }
    }
  });

  // Also scan inline scripts for user data
  const inlineScripts = document.querySelectorAll('script:not([src]):not([type])');
  inlineScripts.forEach((script) => {
    const content = script.textContent || '';
    if (content.includes('"pk"') && content.includes('"username"')) {
      const pkMatches = [...content.matchAll(/"pk"\s*:\s*"(\d+)"/g)];
      const usernameMatches = [...content.matchAll(/"username"\s*:\s*"([\w.]+)"/g)];

      for (const pkMatch of pkMatches) {
        const pk = pkMatch[1];
        const pkIndex = pkMatch.index;
        for (const userMatch of usernameMatches) {
          const username = userMatch[1];
          const userIndex = userMatch.index;
          if (Math.abs(userIndex - pkIndex) < 500) {
            addUserId(username, pk, 'inline');
            break;
          }
        }
      }
    }
  });

  const afterCount = userIdMap.size;
  console.log(`%c[Threads Extractor] 📊 Total users discovered: ${afterCount} (${afterCount - beforeCount} new)`, 'color: #8b5cf6; font-weight: bold;');
  if (userIdMap.size > 0) {
    console.log('  Users:', Object.fromEntries(userIdMap));
  }
  return Object.fromEntries(userIdMap);
}

// ========== MESSAGE HANDLERS FOR CONTENT SCRIPT ==========
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  // Handle user ID lookup request
  if (event.data?.type === 'threads-userid-request') {
    const { requestId, username } = event.data;
    const userId = userIdMap.get(username) || null;
    console.log(`[Threads Extractor] User ID lookup for @${username}: ${userId}`);
    window.postMessage({
      type: 'threads-userid-response',
      requestId: requestId,
      userId: userId
    }, '*');
  }

  // Handle profile fetch request
  if (event.data?.type === 'threads-fetch-request') {
    const { requestId, userId } = event.data;
    console.log(`[Threads Extractor] Profile fetch request for user ID: ${userId}`);
    const result = await throttledFetchProfileInfo(userId);
    window.postMessage({
      type: 'threads-fetch-response',
      requestId: requestId,
      result: result
    }, '*');
  }

  // Handle scan request (triggered on scroll) - disabled for performance
  // User IDs are captured from API responses automatically
  if (event.data?.type === 'threads-scan-request') {
    // Do nothing - API interception handles new users
  }
});

// ========== EXPOSE FUNCTIONS ==========
window.__threadsFetchProfileInfo = throttledFetchProfileInfo;
window.__threadsGetUserIdMap = () => Object.fromEntries(userIdMap);
window.__threadsGetSessionTokens = () => sessionTokens;
window.__threadsIsLoggedIn = isLoggedIn;
window.__threadsScanPage = scanPageForUserIds;
window.__threadsScanTokens = scanPageForSessionTokens;
window.__threadsScanAll = () => {
  scanPageForSessionTokens();
  scanPageForUserIds();
  return { tokens: sessionTokens, users: Object.fromEntries(userIdMap), isLoggedIn: isLoggedIn() };
};

console.log('[Threads Extractor] Network interceptor injected');
console.log('[Threads Extractor] Available functions:');
console.log('  - window.__threadsFetchProfileInfo(userId) - Fetch profile info by user ID');
console.log('  - window.__threadsGetUserIdMap() - Get all discovered username -> userId mappings');
console.log('  - window.__threadsGetSessionTokens() - Get captured session tokens');
console.log('  - window.__threadsIsLoggedIn() - Check if user is logged in');
console.log('  - window.__threadsScanPage() - Scan page for embedded user data');
console.log('  - window.__threadsScanTokens() - Scan page for session tokens');
console.log('  - window.__threadsScanAll() - Scan for both tokens and users');

// Auto-scan after page loads
if (document.readyState === 'complete') {
  setTimeout(() => {
    scanPageForSessionTokens();
    scanPageForUserIds();
  }, 1000);
} else {
  window.addEventListener('load', () => setTimeout(() => {
  scanPageForSessionTokens();
  scanPageForUserIds();
}, 1000));
}
