export const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

export function injectScript() {
  const script = document.createElement('script');
  script.src = browserAPI.runtime.getURL('injected.js');
  script.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(script);
}
