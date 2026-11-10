/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * A Scope is a stack of undo functions. Everything a feature does to the
 * browser (listeners, DOM nodes, observers, pref overrides) is registered on a
 * scope, so disabling the feature is always just `scope.dispose()`. This is
 * what makes every feature live-toggleable and leak-free without each feature
 * hand-writing teardown code.
 */
export class Scope {
  #undo = [];
  disposed = false;

  /** Register an arbitrary cleanup function. */
  add(fn) {
    if (this.disposed) {
      try { fn(); } catch (e) { console.error(e); }
    } else {
      this.#undo.push(fn);
    }
    return fn;
  }

  /** addEventListener with automatic removal. */
  listen(target, type, fn, opts) {
    if (!target) return;
    const safe = (...a) => {
      try { return fn(...a); } catch (e) { console.error("[vivaldifox]", e); }
    };
    target.addEventListener(type, safe, opts);
    this.add(() => target.removeEventListener(type, safe, opts));
  }

  /** Track a DOM node for removal. Returns the node. */
  node(n) {
    this.add(() => n.remove());
    return n;
  }

  /** Observer-service topic. fn(subject, data). */
  observe(topic, fn) {
    const obs = { observe: (s, t, d) => { try { fn(s, d); } catch (e) { console.error("[vivaldifox]", e); } } };
    Services.obs.addObserver(obs, topic);
    this.add(() => Services.obs.removeObserver(obs, topic));
  }

  /** Pref observer. fn(prefName). */
  pref(name, fn) {
    const obs = { observe: (s, t, d) => { try { fn(d); } catch (e) { console.error("[vivaldifox]", e); } } };
    Services.prefs.addObserver(name, obs);
    this.add(() => Services.prefs.removeObserver(name, obs));
  }

  interval(win, fn, ms) {
    const id = win.setInterval(() => { try { fn(); } catch (e) { console.error("[vivaldifox]", e); } }, ms);
    this.add(() => win.clearInterval(id));
    return id;
  }

  /** Set an attribute and restore the previous value on dispose. */
  attr(el, name, value) {
    if (!el) return;
    const had = el.hasAttribute(name), old = el.getAttribute(name);
    el.setAttribute(name, value);
    this.add(() => (had ? el.setAttribute(name, old) : el.removeAttribute(name)));
  }

  /** Set a CSS custom property and remove it on dispose. */
  cssVar(el, name, value) {
    el.style.setProperty(name, value);
    this.add(() => el.style.removeProperty(name));
  }

  /**
   * Override a Firefox pref on the *default branch* for as long as the scope
   * lives. Nothing is written to prefs.js: an explicit user value still wins,
   * and the override vanishes on disable, on uninstall, and in safe mode.
   */
  nativePref(name, value) {
    const def = Services.prefs.getDefaultBranch("");
    const type = typeof value;
    let old;
    try {
      old = type === "boolean" ? def.getBoolPref(name) : type === "number" ? def.getIntPref(name) : def.getStringPref(name);
    } catch { old = undefined; }
    const set = v => {
      try {
        if (type === "boolean") def.setBoolPref(name, v);
        else if (type === "number") def.setIntPref(name, v);
        else def.setStringPref(name, v);
      } catch (e) { console.error("[vivaldifox] nativePref", name, e); }
    };
    set(value);
    this.add(() => { if (old !== undefined) set(old); });
  }

  /** A child scope disposed together with (or before) this one. */
  child() {
    const c = new Scope();
    this.add(() => c.dispose());
    return c;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    while (this.#undo.length) {
      try { this.#undo.pop()(); } catch (e) { console.error("[vivaldifox] cleanup", e); }
    }
  }
}
