/* MPL-2.0. T9: hibernate (unload) background tabs. Builds on native tab unloading. */
import { h, addToPopup } from "../../core/ui.sys.mjs";

function hibernateBackground(win, ctx) {
  const gB = win.gBrowser;
  const keepPinned = ctx.opt("skipPinned");
  const tabs = gB.tabs.filter(t =>
    !t.selected && t.linkedPanel && !t.hasAttribute("pending") &&
    !(keepPinned && t.pinned) && !t.soundPlaying);
  for (const t of tabs) {
    try { gB.discardBrowser(t); } catch (e) { console.error("[vivaldifox] discard", e); }
  }
  return tabs.length;
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "tabs.hibernateBackground", label: "Hibernate background tabs", run: w => hibernateBackground(w, ctx) });
  },
  window(win, scope, ctx) {
    addToPopup(scope, win, "tabContextMenu", h(win.document, "menuitem", {
      id: "vfx-hibernate-bg", label: "Hibernate Background Tabs",
      oncommand: () => hibernateBackground(win, ctx),
    }), "context_closeTabOptions");
  },
};
