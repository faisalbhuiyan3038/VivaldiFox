/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Sidebar peek engine: shared infrastructure for auto-hiding Firefox's native
 * vertical-tabs sidebar, Arc / Vivaldi style. Features request a mode; the
 * engine materialises in a window only while at least one request exists and
 * vertical tabs are on, and removes every trace of itself afterwards.
 *
 * Modes (highest-priority request wins):
 *   docked  the sidebar stays in the layout (only the toolbar button changes)
 *   strip   a column of icons stays visible; hovering expands the sidebar over
 *           the page
 *   hidden  the sidebar is off-screen; touching the window edge slides it in
 *           as a floating card over the page
 *   gone    not shown at all (used by "hide the user interface", full mode)
 *
 * Why not Firefox's own "expand on hover": it animates with view-transition
 * snapshots (frozen images of the sidebar), debounces every hover and has no
 * fully hidden mode. Here the launcher stays expanded and laid out once; it is
 * only moved (transform) or clipped (clip-path), which the compositor animates
 * without re-laying out tabs or freezing the page.
 */
const VERTICAL = "sidebar.verticalTabs";
const XHTML = "http://www.w3.org/1999/xhtml";

const engines = new WeakMap(); // win -> Engine

class Engine {
  constructor(win) {
    this.win = win;
    this.doc = win.document;
    this.requests = new Set();
    this.active = null; // current mode while materialised
    this.revealed = false;
    this.cleanup = [];
  }

  top() {
    let best = null;
    for (const r of this.requests) if (!best || r.priority > best.priority || (r.priority === best.priority && r.seq > best.seq)) best = r;
    return best;
  }

  /** Re-evaluate after any change of requests, prefs or window state. */
  update() {
    const req = this.top();
    const vertical = Services.prefs.getBoolPref(VERTICAL, false);
    const container = this.doc.getElementById("sidebar-container");
    if (!req || !vertical || !container || !this.win.SidebarController) {
      this.deactivate();
      return;
    }
    if (!this.active) this.activate();
    this.setMode(req.mode);
  }

  // ───────────────────────────── lifecycle ─────────────────────────────
  activate() {
    const { win, doc } = this;
    const SC = win.SidebarController;
    const state = SC._state;
    const setter = state && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(state), "launcherExpanded")?.set;
    if (!setter) throw new Error("SidebarController launcher state is not available in this Firefox version");
    this.container = doc.getElementById("sidebar-container");
    this.main = this.container.querySelector("sidebar-main");
    this.root = doc.documentElement;
    this.userExpanded = state.launcherExpanded;
    this.userVisible = state.launcherVisible;

    // Firefox's own expand-on-hover would fight us: switch it off while we run.
    this.hadExpandOnHover = this.root.hasAttribute("sidebar-expand-on-hover");
    if (this.hadExpandOnHover) {
      try { SC.toggleExpandOnHover(false); } catch (e) { console.error("[vivaldifox] sidebar takeover", e); }
    }
    this.root.setAttribute("vfx-sb-side", Services.prefs.getBoolPref("sidebar.position_start", true) ? "start" : "end");

    // Hot zone: a thin real element at the window edge. Chrome never sees
    // mouse events over web content, so the edge must be chrome itself.
    this.hotzone = doc.createElementNS(XHTML, "div");
    this.hotzone.id = "vfx-sb-hotzone";
    doc.getElementById("browser").append(this.hotzone);

    const on = (target, type, fn, opts) => {
      if (!target) return;
      const safe = e => { try { fn(e); } catch (err) { console.error("[vivaldifox] sidebar", err); } };
      target.addEventListener(type, safe, opts);
      this.cleanup.push(() => target.removeEventListener(type, safe, opts));
    };
    const hoverTarget = this.main || this.container;
    on(this.hotzone, "mouseenter", () => this.onEnter(true));
    on(this.hotzone, "dragenter", () => this.reveal());
    on(hoverTarget, "mouseenter", () => this.onEnter(false));
    on(hoverTarget, "mouseleave", () => this.onLeave());
    on(this.hotzone, "mouseleave", () => this.onLeave());
    on(this.container, "dragstart", () => { this.dragging = true; });
    on(doc, "dragend", () => { this.dragging = false; this.later(this.maybeHide, this.hideDelay()); }, true);
    on(this.container, "focusin", () => this.cancel());
    on(this.container, "focusout", () => this.later(this.maybeHide, this.hideDelay()));
    // Menus and panels opened while peeking keep it open (a tab's context
    // menu lies outside the sidebar, so leaving the sidebar for it must not
    // close it). Tooltips do not count.
    this.popups = new Set();
    on(doc, "popupshown", e => {
      const t = e.target;
      if (!this.revealed || !/^(menupopup|panel)$/.test(t.localName) || t.id === "aHTMLTooltip") return;
      this.popups.add(t);
    }, true);
    on(doc, "popuphidden", e => {
      if (this.popups.delete(e.target) && !this.popups.size) this.later(this.maybeHide, this.hideDelay());
    }, true);
    // Esc dismisses a peek; it does not come back until the pointer has left.
    on(win, "keydown", e => {
      if (e.key === "Escape" && this.revealed && this.active !== "docked" && !this.popups.size) {
        this.escaped = true;
        this.hide();
      }
      if (e.ctrlKey && /^(Tab|PageUp|PageDown)$/.test(e.key)) this.keyboardSwitchAt = win.performance.now();
    }, true);
    // Peek where a keyboard tab switch landed, as Arc does.
    on(win.gBrowser.tabContainer, "TabSelect", () => {
      const req = this.top();
      if (req?.peekOnSwitch && this.active && this.active !== "docked" && win.performance.now() - (this.keyboardSwitchAt || -1e9) < 600) this.peek(900);
    });
    // The native sidebar button pins / unpins instead of collapsing.
    on(win, "command", e => {
      if (e.target?.id !== "sidebar-button") return;
      const req = this.top();
      if (!req?.onToggle) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      req.onToggle();
    }, true);
    // Firefox may collapse the launcher on its own (e.g. when its own button
    // logic runs): keep it expanded while we need it.
    const mo = new win.MutationObserver(() => this.ensureExpanded());
    mo.observe(this.container, { attributes: true, attributeFilter: ["sidebar-launcher-expanded", "hidden"] });
    this.cleanup.push(() => mo.disconnect());
    // The strip width follows the favicon column, so icons stay centred.
    const ro = new win.ResizeObserver(() => { this.measureStrip(); this.updateOffset(); });
    ro.observe(this.container);
    ro.observe(doc.getElementById("browser"));
    // The panel bar comes and goes with the panel features.
    const pmo = new win.MutationObserver(() => this.updateOffset());
    pmo.observe(doc.getElementById("browser"), { childList: true });
    this.cleanup.push(() => pmo.disconnect());
    this.cleanup.push(() => ro.disconnect());
    on(win.gBrowser.tabContainer, "TabOpen", () => win.requestAnimationFrame(() => this.measureStrip()));
    on(win.gBrowser.tabContainer, "TabPinned", () => win.requestAnimationFrame(() => this.measureStrip()));

    this.reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)").matches || !Services.prefs.getBoolPref("sidebar.animation.enabled", true);
    this.root.toggleAttribute("vfx-sb-instant", this.reducedMotion);
    this.active = "init";
  }

  deactivate() {
    if (!this.active) return;
    this.cancel();
    for (const fn of this.cleanup.splice(0)) { try { fn(); } catch {} }
    this.hotzone?.remove();
    for (const a of ["vfx-sb-mode", "vfx-sb-peek", "vfx-sb-side", "vfx-sb-instant"]) this.root.removeAttribute(a);
    this.root.style.removeProperty("--vfx-sb-strip");
    this.root.style.removeProperty("--vfx-sb-offset");
    const SC = this.win.SidebarController;
    try {
      if (SC?._state) {
        if (SC._state.launcherExpanded !== this.userExpanded) SC._state.launcherExpanded = this.userExpanded;
        if (this.userVisible === false && SC._state.launcherVisible) SC._state.launcherVisible = false;
      }
      if (this.hadExpandOnHover && SC?.sidebarRevampVisibility === "expand-on-hover") SC.toggleExpandOnHover(true);
    } catch (e) { console.error("[vivaldifox] sidebar restore", e); }
    this.active = null;
    this.revealed = false;
  }

  setMode(mode) {
    if (mode === this.active) return;
    const wasOverlay = this.active && this.active !== "init" && this.active !== "docked";
    this.active = mode;
    this.revealed = false;
    this.root.removeAttribute("vfx-sb-peek");
    this.root.setAttribute("vfx-sb-mode", mode);
    const SC = this.win.SidebarController;
    if (mode === "docked") {
      // Back to the user's own expanded / collapsed choice.
      if (wasOverlay && SC._state.launcherExpanded !== this.userExpanded) SC._state.launcherExpanded = this.userExpanded;
    } else {
      this.ensureExpanded();
      this.updateOffset();
      this.measureStrip();
      // Expanding re-lays out the launcher: measure again once that has happened.
      this.win.requestAnimationFrame(() => this.win.requestAnimationFrame(() => this.measureStrip()));
    }
  }

  /** Overlay modes need the launcher visible and expanded (laid out once, never reflowed). */
  ensureExpanded() {
    if (!this.active || this.active === "docked" || this.active === "gone") return;
    const state = this.win.SidebarController?._state;
    if (!state) return;
    try {
      if (state.launcherVisible === false) state.launcherVisible = true;
      if (!state.launcherExpanded) state.launcherExpanded = true;
    } catch (e) { console.error("[vivaldifox] sidebar expand", e); }
  }

  /** The side-panel bar (core/panels) may sit at the same window edge: start after it. */
  updateOffset() {
    const p = this.doc.getElementById("vfx-panels");
    const side = this.root.getAttribute("vfx-sb-side") === "end" ? "right" : "left";
    let w = 0;
    if (p && p.getAttribute("side") === side) {
      const cs = this.win.getComputedStyle(p);
      if (cs.display !== "none" && cs.position !== "absolute") w = Math.round(p.getBoundingClientRect().width);
    }
    if (w) this.root.style.setProperty("--vfx-sb-offset", w + "px");
    else this.root.style.removeProperty("--vfx-sb-offset");
  }

  measureStrip() {
    if (this.active !== "strip") return;
    // From the tab's content box rather than its icon: a tab without a
    // favicon (about:blank) has an empty icon box. Icons are 16px wide.
    const content = this.doc.querySelector("#tabbrowser-tabs .tabbrowser-tab:not([pinned]):not([hidden]) .tab-content");
    const c = this.container.getBoundingClientRect();
    if (!content || !c.width) return;
    const r = content.getBoundingClientRect();
    const pad = parseFloat(this.win.getComputedStyle(content).paddingInlineStart) || 0;
    const start = this.root.getAttribute("vfx-sb-side") !== "end";
    const center = start ? r.left + pad + 8 - c.left : c.right - (r.right - pad - 8);
    const w = Math.round(Math.max(40, Math.min(center * 2, 80)));
    this.root.style.setProperty("--vfx-sb-strip", w + "px");
  }

  // ───────────────────────────── reveal / hide ─────────────────────────────
  hideDelay() { return this.top()?.hideDelay ?? 300; }

  later(fn, ms) {
    this.cancel();
    this.timer = this.win.setTimeout(() => { this.timer = 0; fn.call(this); }, ms);
  }
  cancel() {
    if (this.timer) this.win.clearTimeout(this.timer);
    this.timer = 0;
  }

  onEnter(fromEdge) {
    if (this.active !== "hidden" && this.active !== "strip") return;
    if (this.escaped) return;
    this.cancel();
    if (this.revealed) return;
    if (fromEdge && this.active !== "hidden") return;
    const req = this.top();
    const delay = req?.revealDelay ?? (this.active === "strip" ? 120 : 0);
    if (delay <= 0) this.reveal();
    else this.later(() => { if (this.isHovered()) this.reveal(); }, delay);
  }

  onLeave() {
    this.escaped = false;
    if (!this.revealed) { this.cancel(); return; }
    this.later(this.maybeHide, this.hideDelay());
  }

  isHovered() {
    return !!((this.main || this.container).matches(":hover") || this.hotzone?.matches(":hover"));
  }

  maybeHide() {
    if (!this.revealed || this.active === "docked") return;
    if (this.isHovered() || this.popups.size || this.dragging || this.container.matches(":focus-within")) return;
    this.hide();
  }

  reveal() {
    if (this.active !== "hidden" && this.active !== "strip") return;
    this.cancel();
    this.revealed = true;
    this.root.setAttribute("vfx-sb-peek", "true");
  }

  hide() {
    this.cancel();
    this.revealed = false;
    this.root.removeAttribute("vfx-sb-peek");
  }

  /** Show for `ms`, then hide unless the pointer has moved onto it. */
  peek(ms = 900) {
    if (this.active !== "hidden" && this.active !== "strip") return;
    this.reveal();
    this.later(this.maybeHide, ms);
  }
}

function engine(win) {
  let e = engines.get(win);
  if (!e) {
    e = new Engine(win);
    engines.set(win, e);
  }
  return e;
}

let seq = 0;

export const SidebarPeek = {
  /**
   * Request a sidebar mode in `win` for the lifetime of `scope`.
   * req: { mode, priority = 0, revealDelay?, hideDelay?, peekOnSwitch?, onToggle? }
   * Returns a handle: set(changes) updates the request, peek(ms) shows it briefly.
   */
  request(scope, win, req) {
    const e = engine(win);
    const r = { priority: 0, ...req, seq: ++seq };
    e.requests.add(r);
    // Follow vertical-tabs and position changes live while any request exists.
    const obs = { observe: () => { try { e.deactivate(); e.update(); } catch (err) { console.error("[vivaldifox] sidebar", err); } } };
    Services.prefs.addObserver(VERTICAL, obs);
    Services.prefs.addObserver("sidebar.position_start", obs);
    Services.prefs.addObserver("sidebar.visibility", obs);
    scope.add(() => {
      Services.prefs.removeObserver(VERTICAL, obs);
      Services.prefs.removeObserver("sidebar.position_start", obs);
      Services.prefs.removeObserver("sidebar.visibility", obs);
      e.requests.delete(r);
      try { e.update(); } catch (err) { console.error("[vivaldifox] sidebar", err); }
    });
    e.update();
    return {
      set(changes) { Object.assign(r, changes); e.update(); },
      peek: ms => e.peek(ms),
      get state() { return { mode: e.active, revealed: e.revealed }; },
    };
  },
  state(win) {
    const e = engines.get(win);
    return { mode: e?.active || null, revealed: !!e?.revealed };
  },
};
