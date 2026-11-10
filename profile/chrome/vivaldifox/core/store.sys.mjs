/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Tiny JSON document store: <profile>/vivaldifox-data/<name>.json.
 * Used for user data that does not belong in prefs (notes, sessions,
 * workspaces, web panel list...). Writes are atomic and debounced.
 */
const DIR = PathUtils.join(PathUtils.profileDir, "vivaldifox-data");
const cache = new Map();
const timers = new Map();
const listeners = new Map();

export const Store = {
  dir: DIR,

  /** Load (and cache) a document. `fallback` is used when the file is absent or corrupt. */
  async load(name, fallback = {}) {
    if (cache.has(name)) return cache.get(name);
    let data = fallback;
    try {
      data = await IOUtils.readJSON(PathUtils.join(DIR, `${name}.json`));
    } catch (e) {
      if (e.name !== "NotFoundError") console.error("[vivaldifox] store", name, e);
    }
    // A concurrent load may have won the race.
    if (!cache.has(name)) cache.set(name, data);
    return cache.get(name);
  },

  /** Persist the cached document (debounced). Call after mutating it. */
  save(name, { immediate = false } = {}) {
    for (const fn of listeners.get(name) || []) {
      try { fn(cache.get(name)); } catch (e) { console.error(e); }
    }
    if (timers.has(name)) return;
    const write = async () => {
      timers.delete(name);
      try {
        await IOUtils.makeDirectory(DIR, { ignoreExisting: true });
        const p = PathUtils.join(DIR, `${name}.json`);
        await IOUtils.writeJSON(p, cache.get(name), { tmpPath: p + ".tmp" });
      } catch (e) { console.error("[vivaldifox] store save", name, e); }
    };
    if (immediate) return write();
    timers.set(name, true);
    lazyTimer(write);
  },

  /** Subscribe to saves of a document. Returns an unsubscribe function. */
  onChange(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => listeners.get(name).delete(fn);
  },
};

/** One-shot timer; the Set keeps it alive until it fires (nsITimer is not self-rooting). */
const liveTimers = new Set();
function lazyTimer(fn) {
  const t = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  liveTimers.add(t);
  t.initWithCallback({ notify: () => { liveTimers.delete(t); fn(); } }, 400, Ci.nsITimer.TYPE_ONE_SHOT);
}
