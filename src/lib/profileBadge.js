/**
 * Shared badge-building helpers for profile info badges (post view + followers/following list)
 */
import { isNewUser } from './dateParser.js';
import { isDisposableHandle } from './disposableHandle.js';
import { createDisposableTag } from './disposableTag.js';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Append the [NEW] and disposable-handle tags to a badge, if applicable
 * @param {HTMLElement} badge
 * @param {Object} profileInfo
 * @param {{marginLeft?: boolean}} options - whether tags get a left margin (friendships list style)
 */
export function appendStatusTags(badge, profileInfo, { marginLeft = false } = {}) {
  const isNew = isNewUser(profileInfo.joined);
  if (isNew && !profileInfo.isVerified) {
    const newLabel = browserAPI.i18n.getMessage('newUser') || 'NEW';
    const newTag = document.createElement('span');
    newTag.className = 'threads-new-user-tag';
    newTag.textContent = `[${newLabel}]`;
    if (marginLeft) newTag.style.marginLeft = '4px';
    badge.appendChild(newTag);
  }

  if (isDisposableHandle(profileInfo.username).isDisposable) {
    const disposableTag = createDisposableTag();
    if (marginLeft) disposableTag.style.marginLeft = '4px';
    badge.appendChild(disposableTag);
  }
}
