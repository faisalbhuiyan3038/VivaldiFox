/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * VivaldiFox boot module. Imported once per session by config.js.
 *
 * Responsibilities:
 *   - declare default prefs for every feature (all features default OFF)
 *   - start/stop each feature independently when its pref (or the master
 *     switch) changes, live, with no restart
 *   - isolate failures: a feature that throws is marked failed and skipped;
 *     it can never take another feature (or the browser) down with it
 *
 * Feature contract (features/<id>/main.sys.mjs, default export, all optional):
 *   start(scope, ctx)        once, when the feature turns on
 *   window(win, scope, ctx)  for every browser window, existing and future
 * Teardown is implicit: everything is registered on `scope` (see scope.sys.mjs).
 */
import { FEATURES } from "./features.sys.mjs";
import { Scope } from "./core/scope.sys.mjs";
import { Commands } from "./core/commands.sys.mjs";
import { Store } from "./core/store.sys.mjs";
import { Panels } from "./core/panels.sys.mjs";
import { captureLayout } from "./core/relocate.sys.mjs";

import { Fx } from "./core/fx.sys.mjs";

export const BASE = "chrome://vivaldifox/content/";
export const PREF = "vivaldifox.";
const MASTER = PREF + "enabled";
const defaults = Services.prefs.getDefaultBranch("");

/** id -> { def, scope, wins: Map<win, Scope>, error, running } */
const state = new Map();

function setDefault(name, type, value) {
  try {
    if (type === "bool") defaults.setBoolPref(name, !!value);
    else if (type === "int") defaults.setIntPref(name, value | 0);
    else defaults.setStringPref(name, type === "json" ? JSON.stringify(value) : String(value));
  } catch (e) { console.error("[vivaldifox] default pref", name, e); }
}

function readOpt(def, key) {
  const o = def.options?.[key];
  if (!o) throw new Error(`${def.id}: unknown option ${key}`);
  const name = `${PREF}${def.id}.${key}`;
  try {
    if (o.type === "bool") return Services.prefs.getBoolPref(name);
    if (o.type === "int") return Services.prefs.getIntPref(name);
    const s = Services.prefs.getStringPref(name);
    return o.type === "json" ? JSON.parse(s) : s;
  } catch (e) {
    // Corrupt user value (e.g. invalid JSON typed into about:config).
    return o.default;
  }
}

function writeOpt(def, key, value) {
  const o = def.options[key];
  const name = `${PREF}${def.id}.${key}`;
  if (o.type === "bool") Services.prefs.setBoolPref(name, !!value);
  else if (o.type === "int") Services.prefs.setIntPref(name, value | 0);
  else Services.prefs.setStringPref(name, o.type === "json" ? JSON.stringify(value) : String(value));
}

function makeCtx(st) {
  const def = st.def;
  return {
    id: def.id,
    base: `${BASE}features/${def.id}/`,
    opt: key => readOpt(def, key),
    setOpt: (key, v) => writeOpt(def, key, v),
    Commands, Store, Scope,
    Fx,
    get CustomizableUI() { return Fx.CustomizableUI; },
    /** True if another feature is currently running (for *optional* bridges only). */
    isRunning: id => !!state.get(id)?.running,
    log: (...a) => console.log(`[vivaldifox:${def.id}]`, ...a),

    /**
     * Create a toolbar widget for the lifetime of `scope`.
     * `area` is only the *first-time* placement; afterwards the user's
     * customization is remembered by Firefox, including removal.
     */
    widget(scope, w) {
      const CUI = Fx.CustomizableUI;
      const id = w.id;
      try { CUI.destroyWidget(id); } catch {}
      CUI.createWidget({
        id,
        type: w.type || "button",
        label: w.label,
        tooltiptext: w.tooltip || w.label,
        defaultArea: w.area === undefined ? CUI.AREA_NAVBAR : w.area,
        removable: true,
        overflows: w.overflows ?? true,
        onCreated: node => {
          node.classList.add("vfx-widget");
          if (w.icon) node.style.listStyleImage = `url("${w.icon}")`;
          try { w.onCreated?.(node, node.ownerDocument.defaultView); } catch (e) { console.error(e); }
        },
        onBuild: w.onBuild && (doc => {
          const node = w.onBuild(doc, doc.defaultView);
          node.id = id;
          node.classList.add("vfx-widget");
          return node;
        }),
        onCommand: w.onCommand && (ev => {
          try { w.onCommand(ev, ev.target.ownerDocument.defaultView); } catch (e) { console.error(`[vivaldifox:${def.id}]`, e); }
        }),
      });
      // A widget remembered in an area that no longer exists (e.g. the status
      // bar was switched off) would be invisible; bring it back to the nav bar.
      try {
        const place = CUI.getPlacementOfWidget(id);
        if (place && !CUI.areas.includes(place.area)) CUI.addWidgetToArea(id, CUI.AREA_NAVBAR);
      } catch {}
      scope.add(() => { try { CUI.destroyWidget(id); } catch {} });
      return id;
    },
  };
}

function loadSheet(win, url) {
  const u = win.windowUtils;
  try { u.loadSheetUsingURIString(url, u.AUTHOR_SHEET); } catch (e) { console.error("[vivaldifox] css", url, e); }
  return () => { try { u.removeSheetUsingURIString(url, u.AUTHOR_SHEET); } catch {} };
}

function attachWindow(st, win) {
  if (st.wins.has(win) || win.closed) return;
  captureLayout(win);
  const scope = st.scope.child();
  st.wins.set(win, scope);
  scope.add(() => st.wins.delete(win));
  scope.listen(win, "unload", () => scope.dispose(), { once: true });
  if (st.def.css) scope.add(loadSheet(win, `${BASE}features/${st.def.id}/style.css`));
  if (st.mod?.window) {
    try {
      st.mod.window(win, scope, st.ctx);
    } catch (e) {
      fail(st, e);
    }
  }
}

function fail(st, e) {
  st.error = String(e?.message || e) + (e?.stack ? "\n" + e.stack.split("\n").slice(0, 4).join("\n") : "");
  console.error(`[vivaldifox:${st.def.id}] FAILED`, e);
  // Roll back whatever part of the feature did start.
  st.running = false;
  st.scope?.dispose();
}

function wanted(def) {
  return Services.prefs.getBoolPref(MASTER, true) && Services.prefs.getBoolPref(`${PREF}${def.id}.enabled`, false);
}

function browserWindows() {
  return [...Services.wm.getEnumerator("navigator:browser")].filter(w => !w.closed && w.gBrowser && w.gBrowserInit?.delayedStartupFinished);
}

function startFeature(st) {
  if (st.running) return;
  st.error = null;
  st.scope = new Scope();
  st.wins = new Map();
  st.ctx = makeCtx(st);
  st.running = true;
  try {
    for (const [name, value] of Object.entries(st.def.native || {})) st.scope.nativePref(name, value);
    const scope = st.scope;
    const attachAll = () => {
      st.ready = true;
      for (const win of browserWindows()) {
        if (!st.running || st.scope !== scope) break;
        attachWindow(st, win);
      }
    };
    st.ready = false;
    let pending = null;
    if (st.def.module) {
      st.mod = ChromeUtils.importESModule(`${BASE}features/${st.def.id}/main.sys.mjs`).default;
      pending = st.mod.start?.(st.scope, st.ctx);
    }
    // start() may be async (e.g. it loads stored data); windows attach afterwards.
    if (pending && typeof pending.then === "function") {
      pending.then(() => { if (st.running && st.scope === scope) attachAll(); }, e => { if (st.scope === scope) fail(st, e); });
    } else {
      attachAll();
    }
  } catch (e) {
    fail(st, e);
  }
}

function stopFeature(st) {
  if (!st.running) return;
  st.running = false;
  st.scope.dispose();
}

function sync(st) {
  wanted(st.def) ? startFeature(st) : stopFeature(st);
}

/** Restart a running feature (used when one of its options changes). */
function restart(st) {
  if (st.restartPending) return;
  st.restartPending = true;
  Services.tm.dispatchToMainThread(() => {
    st.restartPending = false;
    stopFeature(st);
    sync(st);
  });
}

function onWindow(win) {
  loadSheet(win, `${BASE}core/core.css`);
  loadSheet(win, `${BASE}core/panels.css`);
  win.document.documentElement.setAttribute("vivaldifox", "true");
  for (const st of state.values()) if (st.running && st.ready) attachWindow(st, win);
  addToolsMenuItem(win);
}

function addToolsMenuItem(win) {
  try {
    const doc = win.document;
    const popup = doc.getElementById("menu_ToolsPopup");
    if (!popup || doc.getElementById("vfx-menu-options")) return;
    const mi = doc.createXULElement("menuitem");
    mi.id = "vfx-menu-options";
    mi.setAttribute("label", "VivaldiFox Settings");
    mi.addEventListener("command", () => VivaldiFox.openOptions(win));
    popup.appendChild(mi);
  } catch (e) { console.error(e); }
}

export const VivaldiFox = {
  BASE, PREF, FEATURES, Commands, Store, Panels,
  optionsURL: BASE + "options/options.html",

  status() {
    return FEATURES.map(def => {
      const st = state.get(def.id);
      return { id: def.id, enabled: Services.prefs.getBoolPref(`${PREF}${def.id}.enabled`, false), running: !!st.running, error: st.error || null };
    });
  },
  opt(id, key) { return readOpt(state.get(id).def, key); },
  setOpt(id, key, v) { writeOpt(state.get(id).def, key, v); },
  isRunning: id => !!state.get(id)?.running,
  openOptions(win) {
    win.switchToTabHavingURI(this.optionsURL, true, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
  },
};

let booted = false;
function boot() {
  if (booted) return;
  booted = true;

  setDefault(MASTER, "bool", true);
  // Shared panel host settings (not a feature: used by whichever panels are on).
  setDefault(PREF + "panels.side", "string", "left");
  setDefault(PREF + "panels.width", "int", 340);
  setDefault(PREF + "panels.autohide", "bool", false);
  setDefault(PREF + "panels.hidden", "bool", false);
  for (const def of FEATURES) {
    setDefault(`${PREF}${def.id}.enabled`, "bool", false);
    for (const [key, o] of Object.entries(def.options || {})) setDefault(`${PREF}${def.id}.${key}`, o.type === "enum" ? "string" : o.type, o.default);
    state.set(def.id, { def, running: false, wins: new Map(), error: null });
  }

  Commands.register(new Scope(), { id: "vfx.options", label: "VivaldiFox settings", run: w => VivaldiFox.openOptions(w) });
  Commands.register(new Scope(), { id: "panels.toggle", label: "Toggle side panel", run: w => Panels.toggleLast(w) });
  Commands.register(new Scope(), { id: "panels.toggleBar", label: "Show / hide the panel bar", run: () => Panels.toggleBar() });
  Commands.register(new Scope(), { id: "panels.toggleAutohide", label: "Auto-hide the panel bar on / off", run: () => Panels.toggleAutohide() });

  Services.prefs.addObserver(PREF, {
    observe(_s, _t, name) {
      if (name === MASTER) {
        for (const st of state.values()) sync(st);
        return;
      }
      // Longest-id match, because ids may be prefixes of one another.
      let hit = null;
      for (const st of state.values()) {
        if (name.startsWith(`${PREF}${st.def.id}.`) && (!hit || st.def.id.length > hit.def.id.length)) hit = st;
      }
      if (!hit) return;
      const key = name.slice(PREF.length + hit.def.id.length + 1);
      if (key === "enabled") sync(hit);
      else if (hit.running && hit.def.options?.[key] && !hit.def.options[key].live) restart(hit);
    },
  });

  // Global start as soon as the first window is ready (features may need
  // gBrowser, CustomizableUI etc. which are not usable before that).
  let started = false;
  Services.obs.addObserver({
    observe(win) {
      // Record the pristine toolbar layout before any feature can change it.
      try { captureLayout(win); } catch {}
      if (!started) {
        started = true;
        for (const st of state.values()) {
          // Per-feature isolation: one failing feature never blocks the rest.
          try { sync(st); } catch (e) { fail(st, e); }
        }
      }
      try { onWindow(win); } catch (e) { console.error("[vivaldifox]", e); }
    },
  }, "browser-delayed-startup-finished");
}

try {
  boot();
} catch (e) {
  console.error("[vivaldifox] boot failed", e);
}
