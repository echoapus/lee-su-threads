/**
 * DOM helper functions for finding and manipulating Threads UI elements
 */

/**
 * Find the parent container that has both the name section and follow button
 * This is used to locate where to insert location badges/buttons in the followers/following list
 *
 * @param {HTMLElement} container - The container element to search within
 * @param {string} username - The username to find (without @)
 * @returns {HTMLElement|null} - The parent container element or null if not found
 */
export function findUsernameContainer(container, username) {
  // Find the profile link first
  const profileLink = container.querySelector(`a[href="/@${username}"]`);
  if (!profileLink) {
    return null;
  }

  // Navigate up from the profile link to find the container that has a button with role="button"
  // This container will have the username, profile pic, and follow/following button
  let current = profileLink;

  for (let i = 0; i < 15 && current; i++) {
    const parent = current.parentElement;
    if (parent) {
      // Look for any button child (could be "Follow", "Following", "Follow Back", etc.)
      const hasButton = Array.from(parent.children).some(child =>
        child.getAttribute &&
        child.getAttribute('role') === 'button' &&
        child.tagName.toLowerCase() !== 'a' // Exclude link buttons
      );

      if (hasButton) {
        return parent;
      }
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Find the post container element by traversing up the DOM tree
 * Used for identifying where to insert profile badges in the timeline feed
 *
 * @param {HTMLElement} element - Starting element
 * @returns {HTMLElement|null} - The post container element or null if not found
 */
export function findPostContainer(element) {
  let current = element;
  let depth = 0;
  const maxDepth = 20; // Increased for notification pages which have deeper nesting

  while (current && depth < maxDepth) {
    if (current.getAttribute) {
      // Prioritize data-pressable-container (most reliable)
      if (current.getAttribute('data-pressable-container') === 'true') {
        // Verify this container has a profile link (ensures we have the right container)
        const hasProfileLink = current.querySelector('a[href^="/@"]');
        if (hasProfileLink) {
          return current;
        }
        // If no profile link, continue searching upward (might be a nested container)
      }

      // Fallback to ARTICLE tag
      if (current.tagName === 'ARTICLE') {
        return current;
      }
    }

    current = current.parentElement;
    depth++;
  }

  return null;
}

/**
 * Detect which tab is currently active in the followers/following dialog
 * Uses tab position instead of text matching for language-agnosticism
 *
 * @param {NodeList} tabs - List of tab elements with role="tab"
 * @returns {{isFollowers: boolean, isFollowing: boolean}} - Which tab is active
 */
export function detectActiveTab(tabs) {
  let isFollowers = false;
  let isFollowing = false;

  tabs.forEach((tab, index) => {
    if (tab.getAttribute('aria-selected') === 'true') {
      // Use tab position instead of string matching (language-agnostic)
      // First tab (index 0) = Followers
      // Second tab (index 1) = Following
      if (index === 0) {
        isFollowers = true;
      } else if (index === 1) {
        isFollowing = true;
      }
    }
  });

  return { isFollowers, isFollowing };
}

/**
 * Detect if an element is within a user-list context (follower/following rows, activity modal user rows)
 * vs a post timeline context, based on DOM structure
 *
 * User-list rows have a horizontal layout: [username/time/bio] [Follow button]
 * Post timeline/activity feed has a vertical layout: everything stacked
 *
 * @param {HTMLElement} container - The container element (from findPostContainer)
 * @returns {boolean} - True if in user-list context, false if in post context
 */
export function isUserListContext(container) {
  return findFollowButtonContainer(container) !== null;
}

/**
 * Find the Follow button container in a user-list row
 * More robust than relying on obfuscated class names
 *
 * User-list rows have a distinctive pattern: the Follow button comes AFTER the
 * username section as a sibling. Key: look for a div containing [role="button"]
 * that comes after a div with a username link.
 *
 * @param {HTMLElement} container - The container element (from findPostContainer)
 * @returns {HTMLElement|null} - The button container div, or null if not found
 */
export function findFollowButtonContainer(container) {
  if (!container) return null;

  // Find all divs that are grandchildren of the container
  const secondLevelDivs = Array.from(container.querySelectorAll(':scope > div > div'));

  // Look for potential Follow button containers
  // These divs contain a [role="button"] and appear at the same level as content
  for (let i = 0; i < secondLevelDivs.length; i++) {
    const div = secondLevelDivs[i];
    const button = div.querySelector('[role="button"]:not(a)');
    if (!button) continue;

    const parent = div.parentElement;
    if (!parent || parent.children.length < 2) continue;

    // Check if this div comes AFTER a sibling that contains username
    const siblings = Array.from(parent.children);
    const buttonIndex = siblings.indexOf(div);

    // Look for a previous sibling that contains a username link
    let hasUsernameBefore = false;
    for (let j = 0; j < buttonIndex; j++) {
      const sibling = siblings[j];
      const usernameLink = sibling.querySelector('a[href^="/@"]');
      if (usernameLink) {
        // Verify this is a username link (not a post link)
        const href = usernameLink.getAttribute('href');
        // Username links are just /@username, not /@username/post/...
        if (href && /^\/@[^/]+$/.test(href)) {
          hasUsernameBefore = true;
          break;
        }
      }
    }

    if (hasUsernameBefore) {
      // Final check: the button text should contain Follow-related text
      const buttonText = button.textContent?.trim() || '';
      const hasFollowText = buttonText.includes('追蹤') ||
                            buttonText.includes('Follow') ||
                            buttonText.includes('フォロー') ||
                            buttonText.includes('팔로우') ||
                            buttonText.includes('关注') ||
                            buttonText.includes('Following') ||
                            buttonText.includes('正在追蹤');

      if (hasFollowText) {
        return div;
      }
    }
  }

  return null;
}

/**
 * Find the username associated with a time element in a post
 * Handles complex cases like reposts where multiple usernames exist
 *
 * @param {HTMLElement} timeEl - The time element to find username for
 * @returns {{username: string|null, profileLink: HTMLElement|null}} - Username and link element
 */
export function findUsernameFromTimeElement(timeEl) {
  let profileLink = null;
  let username = null;

  // First, try to find a profile link that's an ancestor of the time element
  // (i.e., the time element is inside a link to the post, which contains the username)
  const parentLink = timeEl.closest('a[href^="/@"]');
  if (parentLink) {
    const href = parentLink.getAttribute('href');
    // Match username links (with optional query params/hash), but not post links
    const match = href.match(/^\/@([\w.]+)(?:[?#]|$)/);
    if (match) {
      username = match[1];
      profileLink = parentLink;
    }
  }

  // If not found, traverse up to find a nearby username link in the DOM tree
  // This handles reposts where the original poster's link is near the time element
  if (!username) {
    let current = timeEl;
    for (let i = 0; i < 8 && current; i++) {
      current = current.parentElement;
      if (!current) break;

      // Look for a username-only link within this level
      const usernameLinks = current.querySelectorAll('a[href^="/@"]');
      for (const link of usernameLinks) {
        const href = link.getAttribute('href');
        // Match username links (with optional query params/hash), but not post links
        const match = href.match(/^\/@([\w.]+)(?:[?#]|$)/);
        if (match) {
          username = match[1];
          profileLink = link;
          break;
        }
      }
      if (username) break;
    }
  }

  return { username, profileLink };
}
