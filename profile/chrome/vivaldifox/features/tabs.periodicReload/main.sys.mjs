/* MPL-2.0. T10: periodic reload, set per tab from the tab context menu. */
import { h, addToPopup, onPopupShowing, contextTab } from "../../core/ui.sys.mjs";

const CHOICES = [[0, "Off"], [60, "1 minute"], [120, "2 minutes"], [300, "5 minutes"], [600, "10 minutes"], [900, "15 minutes"], [1800, "30 minutes"], [3600, "1 hour"]];

export default {
  window(win, scope) {
    const doc = win.document;
    /** tab -> { secs, timer } */
    const timers = new Map();

    const clear = tab => {
      const t = timers.get(tab);
      if (t) win.clearInterval(t.timer);
      timers.delete(tab);
      tab.removeAttribute("vfx-periodic-reload");
    };
    const set = (tab, secs) => {
      clear(tab);
      if (!secs) return;
      const timer = win.setInterval(() => {
        if (!tab.isConnected) return clear(tab);
        // A hibernated tab has nothing to reload; skip instead of waking it.
        if (tab.linkedPanel && !tab.hasAttribute("pending")) tab.linkedBrowser.reload();
      }, secs * 1000);
      timers.set(tab, { secs, timer });
      tab.setAttribute("vfx-periodic-reload", secs);
    };
    scope.add(() => { for (const tab of [...timers.keys()]) clear(tab); });
    scope.listen(win.gBrowser.tabContainer, "TabClose", e => clear(e.target));

    const popup = h(doc, "menupopup");
    for (const [secs, label] of CHOICES) {
      popup.append(h(doc, "menuitem", { type: "radio", name: "vfx-pr", label, value: secs, oncommand: () => set(contextTab(win), secs) }));
    }
    const menu = addToPopup(scope, win, "tabContextMenu", h(doc, "menu", { id: "vfx-periodic-reload", label: "Periodic Reload" }, popup), "context_reloadTab");
    if (menu) {
      onPopupShowing(scope, win, "tabContextMenu", () => {
        const cur = timers.get(contextTab(win))?.secs || 0;
        for (const mi of popup.children) mi.toggleAttribute("checked", Number(mi.getAttribute("value")) === cur);
      });
    }
    // Automation hook (also used by the test-suite).
    win.vfxPeriodicReload = { set, get: tab => timers.get(tab)?.secs || 0 };
    scope.add(() => delete win.vfxPeriodicReload);
  },
};
