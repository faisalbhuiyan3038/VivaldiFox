/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Bridge to web content, used by the few features that must read or change
 * the page itself (next-page detection, page filters, spatial navigation...).
 *
 * Mechanism: per-feature *frame scripts* (features/<id>/content.js) loaded
 * through the window message manager while the feature is enabled.
 *
 * Why not JSWindowActors: as of Firefox 159 an actor registered at runtime is
 * refused in web content processes ("doesn't match remote type 'web'"), so
 * mods can no longer add content actors. Frame scripts still work on 159 and
 * 162 but are a legacy API. This file is therefore the ONE place that knows
 * how content is reached; if Mozilla retires frame scripts, only this file
 * needs a new transport and the features keep their message protocol.
 *
 * Known limit: a frame script sees the tab's top-level document and
 * same-process frames, not cross-site (out-of-process) iframes.
 */
const BASE = "chrome://vivaldifox/content/";
// Cache-buster so an updated content.js is picked up after a browser restart.
const NONCE = Date.now().toString(36);
let seq = 0;

/** Load features/<id>/content.js into every tab of `win`, current and future. */
export function contentScript(scope, win, featureId) {
  const url = `${BASE}features/${featureId}/content.js?${NONCE}`;
  const mm = win.messageManager;
  mm.loadFrameScript(url, true);
  scope.add(() => {
    try { mm.removeDelayedFrameScript(url); } catch {}
    // Frame scripts cannot be unloaded; each one removes its own listeners on this message.
    try { mm.broadcastAsyncMessage(`vfx:${featureId}:unload`); } catch {}
  });
}

/** Fire-and-forget message to one tab. */
export function tell(browser, name, data) {
  try { browser.messageManager?.sendAsyncMessage(name, { data }); } catch {}
}

/** Request/response to one tab. Resolves undefined on timeout or any failure. */
export function ask(browser, name, data, timeout = 3000) {
  return new Promise(resolve => {
    let mm;
    try { mm = browser.messageManager; } catch {}
    if (!mm) return resolve(undefined);
    const id = ++seq, reply = `${name}:reply`;
    const win = browser.ownerDocument.defaultView;
    const done = v => {
      try { mm.removeMessageListener(reply, onReply); } catch {}
      win.clearTimeout(timer);
      resolve(v);
    };
    const onReply = m => { if (m.data?.id === id) done(m.data.result); };
    const timer = win.setTimeout(() => done(undefined), timeout);
    try {
      mm.addMessageListener(reply, onReply);
      mm.sendAsyncMessage(name, { id, data });
    } catch {
      done(undefined);
    }
  });
}

/** Listen for messages from any tab of `win`. fn(data, browser). */
export function listen(scope, win, name, fn) {
  const mm = win.messageManager;
  const l = m => {
    try { fn(m.data, m.target); } catch (e) { console.error("[vivaldifox]", e); }
  };
  mm.addMessageListener(name, l);
  scope.add(() => { try { mm.removeMessageListener(name, l); } catch {} });
}
