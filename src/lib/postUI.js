// Post UI functions for displaying profile info on Threads posts
import { formatLocation } from './locationMapper.js';
import { appendStatusTags } from './profileBadge.js';
import { getUserIdByUsername, fetchProfileByUserId } from './profileFetcher.js';

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Display profile info badge for a user by finding and updating their fetch buttons
 * @param {Object} profileInfo - Profile information object
 */
export function displayProfileInfo(profileInfo) {
  const username = profileInfo.username;

  // Find all fetch buttons for this user
  const postButtons = document.querySelectorAll(`.threads-fetch-btn[data-username="${username}"]`);

  // Handle post-style buttons
  for (const btn of postButtons) {
    // Check if we already added a badge next to this button
    if (btn.previousElementSibling?.classList?.contains('threads-profile-info-badge')) continue;

    // Create the info badge and insert before the button (so it appears to the left)
    const badge = createProfileBadge(profileInfo);
    btn.parentElement?.insertBefore(badge, btn);

    // Hide button after success - badge shows the info
    btn.style.display = 'none';
  }

  // NOTE: We don't handle .threads-friendships-fetch-btn here because:
  // 1. Buttons in friendships dialog (followers/following tabs) are handled by friendshipsUI module
  // 2. Buttons in activity modals are handled by addFetchButtons() in content.js
  // This prevents duplicate badge insertion
}

/**
 * Create a profile info badge element with location and joined date
 * @param {Object} profileInfo - Profile information object
 * @returns {HTMLElement} Badge element
 */
export function createProfileBadge(profileInfo) {
  const badge = document.createElement('span');
  badge.className = 'threads-profile-info-badge';

  const joinedLabel = browserAPI.i18n.getMessage('joined') || 'Joined';

  if (profileInfo.location) {
    // Display location with flag emoji
    badge.textContent = formatLocation(profileInfo.location, false);
    badge.title = `${profileInfo.location} • ${joinedLabel}: ${profileInfo.joined || 'Unknown'}`;
  } else {
    // Location not available - show "無地點資料" with same hover behavior as regular location
    const noLocationData = browserAPI.i18n.getMessage('noLocationData') || 'No location data';
    badge.textContent = noLocationData;
    badge.title = `${joinedLabel}: ${profileInfo.joined || 'Unknown'}`;
  }

  appendStatusTags(badge, profileInfo);

  return badge;
}

/**
 * Auto-fetch profile info for a username
 * @param {string} username - Username to fetch
 * @param {HTMLElement} btn - Button element to update
 * @param {Map} profileCache - Profile cache
 */
export async function autoFetchProfile(username, btn, profileCache) {
  // Skip if already cached
  if (profileCache.has(username)) {
    const cached = profileCache.get(username);
    displayProfileInfo(cached);
    btn.style.display = 'none';
    return;
  }

  const userId = await getUserIdByUsername(username);

  if (!userId) {
    btn.textContent = '❓';
    btn.title = 'User ID not found. Click to retry.';
    btn.disabled = false;
    return;
  }

  const result = await fetchProfileByUserId(userId);

  if (result) {
    if (result._rateLimited) {
      // Rate limited - button will show retry
      btn.textContent = '🔄';
      btn.title = 'Rate limited. Click to retry later.';
      btn.disabled = false;
    } else if (result._loginRequired) {
      // Login required - show lock icon (banner will be shown on manual click)
      btn.textContent = '🔒';
      btn.title = browserAPI.i18n.getMessage('loginRequired') || 'Login required. Click to learn more.';
      btn.disabled = false;
      // Mark button as login-required so click handler knows to show banner
      btn.setAttribute('data-login-required', 'true');
    } else {
      btn.style.display = 'none';
    }
  } else {
    btn.textContent = '🔄';
    btn.title = 'Failed to load. Click to retry.';
    btn.disabled = false;
  }
}
