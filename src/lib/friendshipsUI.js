/**
 * UI injection functions for followers/following dialog
 * Handles creating and inserting location badges and fetch buttons
 */

import { findUsernameContainer } from './domHelpers.js';
import { formatLocation } from './locationMapper.js';
import { fetchProfileByUserId, updateButtonWithFetchResult } from './profileFetcher.js';
import { appendStatusTags } from './profileBadge.js';

// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Inject appropriate location UI for a user (badge, empty indicator, or fetch button)
 * @param {string} username - Username (without @)
 * @param {string} userId - User ID
 * @param {Map} profileCache - Cache of profile data
 */
export function injectLocationUIForUser(username, userId, profileCache) {
  const profileInfo = profileCache.get(username);

  if (profileInfo) {
    if (profileInfo.location) {
      // Has cached data with location - display it
      injectLocationBadgeIntoUserRow(username, profileInfo);
    } else {
      // Has cached data but no location - show empty indicator
      injectEmptyLocationIntoUserRow(username);
    }
  } else if (userId) {
    // No cached data - add a button to fetch on demand
    injectLocationButtonIntoUserRow(username, userId, profileCache);
  }
}

/**
 * Inject a fetch location button into a specific user row
 * @param {string} username - Username (without @)
 * @param {string} userId - User ID
 * @param {Map} profileCache - Cache of profile data
 */
function injectLocationButtonIntoUserRow(username, userId, profileCache) {
  // Find all links to this user's profile
  const profileLinks = document.querySelectorAll(`a[href="/@${username}"]`);

  profileLinks.forEach((link) => {
    // Navigate up to find the user row container
    let userRow = link;
    for (let i = 0; i < 10 && userRow; i++) {
      if (userRow.querySelector && userRow.textContent.includes(username)) {
        // Find the container to insert button
        const insertTarget = findUsernameContainer(userRow, username);
        if (insertTarget) {
          if (insertTarget.querySelector('.threads-friendships-fetch-btn, .threads-friendships-location-badge')) break;
          const btn = createFriendshipsLocationButton(username, userId, profileCache);
          // Find the follow button that is a direct child
          const followButton = Array.from(insertTarget.children).find(child =>
            child.getAttribute && child.getAttribute('role') === 'button'
          );
          if (followButton) {
            insertTarget.insertBefore(btn, followButton);
          } else {
            // No follow button (e.g., own profile) - append to end
            insertTarget.appendChild(btn);
          }

          break;
        }
      }
      userRow = userRow.parentElement;
    }
  });
}

/**
 * Create a fetch location button for friendships list
 * @param {string} username - Username (without @)
 * @param {string} userId - User ID
 * @param {Map} profileCache - Cache of profile data
 * @returns {HTMLButtonElement} - The created button
 */
function createFriendshipsLocationButton(username, userId, profileCache) {
  const btn = document.createElement('button');
  btn.className = 'threads-friendships-fetch-btn';
  btn.textContent = '📍';
  btn.title = `Get location for @${username}`;
  btn.setAttribute('data-username', username);
  btn.setAttribute('data-userid', userId);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    btn.disabled = true;
    btn.textContent = '⏳';

    // Fetch profile info using shared utility
    const profileInfo = await fetchProfileByUserId(userId);

    // Update button with result using shared utility
    updateButtonWithFetchResult(btn, username, profileInfo, profileCache, createLocationBadge);
  });

  return btn;
}

/**
 * Inject location badge into a specific user row in followers/following list
 * @param {string} username - Username (without @)
 * @param {Object} profileInfo - Profile information object
 */
function injectLocationBadgeIntoUserRow(username, profileInfo) {
  // Find all links to this user's profile
  const profileLinks = document.querySelectorAll(`a[href="/@${username}"]`);

  for (const link of profileLinks) {
    // Navigate up to find the user row container
    let userRow = link;
    for (let i = 0; i < 10 && userRow; i++) {
      // Look for the container that has the username
      if (userRow.querySelector && userRow.textContent.includes(username)) {
        // Find where to insert the badge
        const insertTarget = findUsernameContainer(userRow, username);
        if (insertTarget) {
          if (insertTarget.querySelector('.threads-friendships-location-badge')) break;
          const badge = createLocationBadge(profileInfo);
          // Find the follow button that is a direct child
          const followButton = Array.from(insertTarget.children).find(child =>
            child.getAttribute && child.getAttribute('role') === 'button'
          );
          if (followButton) {
            insertTarget.insertBefore(badge, followButton);
          } else {
            // No follow button (e.g., own profile) - append to end
            insertTarget.appendChild(badge);
          }
          break;
        }
      }
      userRow = userRow.parentElement;
    }
  }
}

/**
 * Inject empty location indicator into a specific user row in followers/following list
 * @param {string} username - Username (without @)
 */
function injectEmptyLocationIntoUserRow(username) {
  // Find all links to this user's profile
  const profileLinks = document.querySelectorAll(`a[href="/@${username}"]`);

  profileLinks.forEach(link => {
    // Navigate up to find the user row container
    let userRow = link;
    for (let i = 0; i < 10 && userRow; i++) {
      // Look for the container that has the username
      if (userRow.querySelector && userRow.textContent.includes(username)) {
        // Find where to insert the indicator
        const insertTarget = findUsernameContainer(userRow, username);
        if (insertTarget) {
          if (insertTarget.querySelector('.threads-friendships-fetch-btn, .threads-friendships-location-badge')) break;
          const emptyIndicator = createEmptyLocationIndicator(username);
          // Find the follow button that is a direct child
          const followButton = Array.from(insertTarget.children).find(child =>
            child.getAttribute && child.getAttribute('role') === 'button'
          );
          if (followButton) {
            insertTarget.insertBefore(emptyIndicator, followButton);
          } else {
            // No follow button (e.g., own profile) - append to end
            insertTarget.appendChild(emptyIndicator);
          }
          break;
        }
      }
      userRow = userRow.parentElement;
    }
  });
}

/**
 * Create an empty location indicator (when cached but no location available)
 * @param {string} username - Username (without @)
 * @returns {HTMLButtonElement} - The created indicator
 */
function createEmptyLocationIndicator(username) {
  const indicator = document.createElement('button');
  indicator.className = 'threads-friendships-fetch-btn'; // Reuse same styling
  indicator.textContent = '➖';
  indicator.title = `No location available for @${username}`;
  indicator.disabled = true;
  indicator.style.cursor = 'default';
  indicator.style.opacity = '0.4';
  return indicator;
}

/**
 * Create a location badge for friendships list
 * @param {Object} profileInfo - Profile information object
 * @returns {HTMLSpanElement} - The created badge
 */
export function createLocationBadge(profileInfo) {
  const badge = document.createElement('span');
  badge.className = 'threads-friendships-location-badge';

  const joinedLabel = browserAPI.i18n.getMessage('joined') || 'Joined';

  const locationText = document.createElement('span');

  if (profileInfo.location) {
    // Display location with flag emoji
    locationText.textContent = formatLocation(profileInfo.location, false);
    badge.appendChild(locationText);

    if (profileInfo.joined) {
      badge.title = `${profileInfo.location} • ${joinedLabel}: ${profileInfo.joined}`;
    } else {
      badge.title = profileInfo.location;
    }
  } else {
    // Location not available - show "無地點資料"
    const noLocationData = browserAPI.i18n.getMessage('noLocationData') || 'No location data';
    locationText.textContent = noLocationData;
    badge.appendChild(locationText);
    badge.title = `${joinedLabel}: ${profileInfo.joined || 'Unknown'}`;
  }

  appendStatusTags(badge, profileInfo, { marginLeft: true });

  return badge;
}
