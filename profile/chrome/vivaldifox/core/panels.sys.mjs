/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Panel host: always-present shared infrastructure for the Vivaldi-style side
 * panel (icon strip + one open panel). Web Panels, Notes, Downloads and
 * Reading List each register their panel here independently; the host only
 * materializes in a window while at least one panel is registered and
 * disappears again with the last one.
 *
 * It deliberately does NOT plug into Firefox's own sidebar (whose internals
 * were rewritten twice recently). The only structural assumption is that the
 * tab content lives in `#browser`; the host is added as a child of that box
 * and positioned with CSS `order`, so it never has to know its siblings.
 */
import { h } from "./ui.sys.mjs";

const SIDE_PREF = "vivaldifox.panels.side";   // "left" | "right"
const WIDTH_PREF = "vivaldifox.panels.width"; // px
const hosts = new WeakMap();

class Host {
  constructor(win) {
    this.win = win;
    this.panels = new Map(); // id -> { def, button, node, cleanup }
    this.current = null;
    this.root = null;
  }

  #ensure() {
    if (this.root) return;
    const doc = this.win.document;
    const parent = doc.getElementById("browser");
    if (!parent) throw new Error("#browser container not found");
    this.strip = h(doc, "vbox", { id: "vfx-panel-strip", role: "toolbar", "aria-label": "Panels" });
    this.title = h(doc, "label", { id: "vfx-panel-title", flex: "1", crop: "end" });
    this.content = h(doc, "vbox", { id: "vfx-panel-content", flex: "1" });
    this.box = h(doc, "vbox", { id: "vfx-panel-box", hidden: "true" }, [
      h(doc, "hbox", { id: "vfx-panel-header", align: "center" }, [
        this.title,
        h(doc, "toolbarbutton", { id: "vfx-panel-close", class: "vfx-panel-hbtn", tooltiptext: "Close panel", label: "✕", oncommand: () => this.close() }),
      ]),
      this.content,
    ]);
    this.grip = h(doc, "html:div", { id: "vfx-panel-grip", hidden: "true" });
    this.root = h(doc, "hbox", { id: "vfx-panels" }, [this.strip, this.box, this.grip]);
    parent.append(this.root);
    this.#applyPrefs();
    this.prefObs = { observe: () => this.#applyPrefs() };
    Services.prefs.addObserver("vivaldifox.panels.", this.prefObs);
    this.#resizable();
  }

  #applyPrefs() {
    if (!this.root) return;
    this.root.setAttribute("side", Services.prefs.getStringPref(SIDE_PREF, "left") === "right" ? "right" : "left");
    const w = Math.max(180, Math.min(Services.prefs.getIntPref(WIDTH_PREF, 340), 1000));
    this.box.style.width = w + "px";
  }

  #resizable() {
    const win = this.win;
    let startX = 0, startW = 0;
    const move = e => {
      const dir = this.root.getAttribute("side") === "right" ? -1 : 1;
      this.box.style.width = Math.max(180, Math.min(startW + (e.screenX - startX) * dir, win.innerWidth - 200)) + "px";
    };
    const up = () => {
      win.removeEventListener("mousemove", move, true);
      win.removeEventListener("mouseup", up, true);
      this.root.removeAttribute("resizing");
      Services.prefs.setIntPref(WIDTH_PREF, Math.round(this.box.getBoundingClientRect().width));
    };
    this.grip.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      startX = e.screenX;
      startW = this.box.getBoundingClientRect().width;
      // While dragging, the page must not swallow mouse events.
      this.root.setAttribute("resizing", "true");
      win.addEventListener("mousemove", move, true);
      win.addEventListener("mouseup", up, true);
      e.preventDefault();
    });
  }

  #teardown() {
    if (!this.root) return;
    Services.prefs.removeObserver("vivaldifox.panels.", this.prefObs);
    this.root.remove();
    this.root = this.strip = this.box = this.content = this.title = this.grip = null;
    this.current = null;
    this.win.document.documentElement.removeAttribute("vfx-panel-open");
  }

  add(def) {
    this.#ensure();
    this.remove(def.id);
    const doc = this.win.document;
    const button = h(doc, "toolbarbutton", {
      class: "vfx-panel-btn", "data-panel": def.id, tooltiptext: def.title, "aria-label": def.title,
      image: def.icon, oncommand: () => this.toggle(def.id),
    });
    if (def.onContext) button.addEventListener("contextmenu", e => { e.preventDefault(); def.onContext(e, button); });
    // Keep a stable order regardless of the order features start in.
    button.style.order = String(def.order ?? 50);
    this.strip.append(button);
    this.panels.set(def.id, { def, button, node: null, cleanup: null });
  }

  remove(id) {
    const p = this.panels.get(id);
    if (!p) return;
    if (this.current === id) this.close();
    try { p.cleanup?.(); } catch (e) { console.error("[vivaldifox] panel cleanup", e); }
    p.node?.remove();
    p.button.remove();
    this.panels.delete(id);
    if (!this.panels.size) this.#teardown();
  }

  open(id) {
    const p = this.panels.get(id);
    if (!p) return false;
    if (!p.node) {
      // Built on first use and kept alive, so a web panel stays loaded.
      p.node = h(this.win.document, "vbox", { class: "vfx-panel", flex: "1", "data-panel": id });
      this.content.append(p.node);
      try {
        p.cleanup = p.def.build(p.node, this.win) || null;
      } catch (e) {
        console.error("[vivaldifox] panel build", id, e);
        p.node.append(h(this.win.document, "description", { text: `This panel failed to load: ${e.message}` }));
      }
    }
    for (const [pid, q] of this.panels) {
      if (q.node) q.node.hidden = pid !== id;
      q.button.toggleAttribute("checked", pid === id);
    }
    this.title.setAttribute("value", p.def.title);
    this.box.hidden = false;
    this.grip.hidden = false;
    this.current = id;
    this.win.document.documentElement.setAttribute("vfx-panel-open", id);
    try { p.def.onShow?.(p.node, this.win); } catch (e) { console.error(e); }
    return true;
  }

  close() {
    if (!this.root) return;
    this.box.hidden = true;
    this.grip.hidden = true;
    for (const q of this.panels.values()) q.button.removeAttribute("checked");
    this.current = null;
    this.win.document.documentElement.removeAttribute("vfx-panel-open");
  }

  toggle(id) {
    if (this.current === id) this.close();
    else this.open(id);
  }
}

function host(win) {
  if (!hosts.has(win)) hosts.set(win, new Host(win));
  return hosts.get(win);
}

export const Panels = {
  /**
   * Register a panel in `win` for the lifetime of `scope`.
   * def: { id, title, icon, order?, build(node, win) -> cleanup?, onShow?(node, win), onContext?(event, button) }
   */
  register(scope, win, def) {
    host(win).add(def);
    scope.add(() => host(win).remove(def.id));
  },
  open: (win, id) => host(win).open(id),
  close: win => host(win).close(),
  toggle: (win, id) => host(win).toggle(id),
  current: win => host(win).current,
  ids: win => [...host(win).panels.keys()],
  /** Toggle the last used (or first) panel: used by the "panels.toggle" command. */
  toggleLast(win) {
    const hst = host(win);
    if (hst.current) {
      hst.last = hst.current;
      hst.close();
    } else {
      const id = hst.panels.has(hst.last) ? hst.last : hst.panels.keys().next().value;
      if (id) hst.open(id);
    }
  },
};
