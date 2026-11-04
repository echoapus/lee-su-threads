/**
 * Notification UI functions for showing toasts and banners
 */

import { browserAPI } from './browserAPI.js';

/**
 * Show rate limit toast notification
 * @param {number} cooldownMs - Cooldown duration in milliseconds
 */
export function showRateLimitToast(cooldownMs) {
  // Remove existing toast if any
  const existing = document.getElementById('threads-rate-limit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'threads-rate-limit-toast';
  const warningMsg = browserAPI.i18n.getMessage('rateLimitWarning') || '⚠️ Too many location queries. Rate limited by Threads.';

  const warningSpan = document.createElement('span');
  warningSpan.textContent = warningMsg;

  const dismissBtn = document.createElement('button');
  dismissBtn.id = 'threads-dismiss-toast';
  dismissBtn.textContent = '✕';

  toast.appendChild(warningSpan);
  toast.appendChild(dismissBtn);
  document.body.appendChild(toast);

  // Dismiss button
  dismissBtn.addEventListener('click', () => {
    toast.remove();
  });

  // Auto-hide after cooldown ends
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, cooldownMs);
}

/**
 * Show login required banner notification
 */
export function showLoginRequiredBanner() {
  console.log('[Threads Extractor] showLoginRequiredBanner called');
  // Remove existing banner if any
  const existing = document.getElementById('threads-login-required-banner');
  if (existing) {
    console.log('[Threads Extractor] Removing existing banner');
    existing.remove();
  }

  const banner = document.createElement('div');
  banner.id = 'threads-login-required-banner';
  console.log('[Threads Extractor] Creating new banner element');
  const warningMsg = browserAPI.i18n.getMessage('loginRequiredWarning') || '🔒 Please log in to Threads to use this extension';
  const hintMsg = browserAPI.i18n.getMessage('loginRequiredHint') || 'Location info can only be fetched when you\'re logged in.';
  const dismissMsg = browserAPI.i18n.getMessage('dismiss') || 'Dismiss';

  const warningSpan = document.createElement('span');
  warningSpan.className = 'threads-login-required-main';
  warningSpan.textContent = warningMsg;

  const hintSpan = document.createElement('span');
  hintSpan.className = 'threads-login-required-hint';
  hintSpan.textContent = hintMsg;

  const dismissBtn = document.createElement('button');
  dismissBtn.id = 'threads-dismiss-login-banner';
  dismissBtn.textContent = dismissMsg;

  banner.appendChild(warningSpan);
  banner.appendChild(hintSpan);
  banner.appendChild(dismissBtn);
  document.body.appendChild(banner);
  console.log('[Threads Extractor] Banner appended to body');

  // Dismiss button
  dismissBtn.addEventListener('click', () => {
    console.log('[Threads Extractor] Banner dismissed');
    banner.remove();
  });
}
