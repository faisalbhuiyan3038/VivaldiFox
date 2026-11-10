/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Resilient access to Firefox's own modules.
 *
 * Mozilla keeps moving module files (resource:///modules/X -> moz-src:///...),
 * which silently breaks every script that imports them by URL. The browser
 * window, however, exposes the important ones as lazy globals whose *names*
 * have been stable for a decade. So: ask a browser window first, and only
 * fall back to a list of known URLs (newest first) when no window offers it.
 *
 *   import { Fx } from ".../core/fx.sys.mjs";
 *   Fx.SessionStore.getClosedTabDataForWindow(win)
 */
const URLS = {
  CustomizableUI: ["moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs", "resource:///modules/CustomizableUI.sys.mjs"],
  SessionStore: ["moz-src:///browser/components/sessionstore/SessionStore.sys.mjs", "resource:///modules/sessionstore/SessionStore.sys.mjs"],
  PlacesUtils: ["resource://gre/modules/PlacesUtils.sys.mjs"],
  AboutNewTab: ["resource:///modules/AboutNewTab.sys.mjs", "moz-src:///browser/components/newtab/AboutNewTab.sys.mjs"],
  HomePage: ["resource:///modules/HomePage.sys.mjs", "moz-src:///browser/modules/HomePage.sys.mjs"],
  PageThumbs: ["resource://gre/modules/PageThumbs.sys.mjs"],
  BackgroundPageThumbs: ["resource://gre/modules/BackgroundPageThumbs.sys.mjs"],
  AddonManager: ["resource://gre/modules/AddonManager.sys.mjs"],
  Downloads: ["resource://gre/modules/Downloads.sys.mjs"],
  PrivateBrowsingUtils: ["resource://gre/modules/PrivateBrowsingUtils.sys.mjs"],
  E10SUtils: ["resource://gre/modules/E10SUtils.sys.mjs"],
  NewTabUtils: ["resource://gre/modules/NewTabUtils.sys.mjs"],
};

const cache = new Map();

function resolve(name) {
  if (cache.has(name)) return cache.get(name);
  let found;
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    try {
      if (win[name] && typeof win[name] === "object") {
        found = win[name];
        break;
      }
    } catch {}
  }
  if (!found) {
    for (const url of URLS[name] || []) {
      try {
        found = ChromeUtils.importESModule(url)[name];
        if (found) break;
      } catch {}
    }
  }
  if (!found) throw new Error(`Firefox module "${name}" is not available in this version`);
  cache.set(name, found);
  return found;
}

export const Fx = new Proxy({}, { get: (_t, name) => (typeof name === "string" ? resolve(name) : undefined) });
