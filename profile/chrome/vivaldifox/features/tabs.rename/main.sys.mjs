/* MPL-2.0. T13: give a tab a custom title that survives navigation and restart. */
import { h, addToPopup, contextTab, promptText } from "../../core/ui.sys.mjs";

import { Fx } from "../../core/fx.sys.mjs";
const KEY = "vivaldifox-tab-name";

const getName = tab => { try { return Fx.SessionStore.getCustomTabValue(tab, KEY) || ""; } catch { return ""; } };

function apply(win, tab) {
  const name = getName(tab);
  if (!name) return;
  if (tab.label !== name) {
    // _setTabLabel is internal; fall back to the public attribute if it goes away.
    if (typeof win.gBrowser._setTabLabel === "function") win.gBrowser._setTabLabel(tab, name);
    else tab.setAttribute("label", name);
  }
  tab.setAttribute("vfx-renamed", "true");
}

function rename(win, tab, name) {
  if (name) {
    Fx.SessionStore.setCustomTabValue(tab, KEY, name);
    apply(win, tab);
  } else {
    try { Fx.SessionStore.deleteCustomTabValue(tab, KEY); } catch {}
    tab.removeAttribute("vfx-renamed");
    win.gBrowser.setTabTitle(tab);
  }
}

function ask(win, tab) {
  const v = promptText(win, "Rename Tab", "Tab title (leave empty to restore the page title):", getName(tab) || tab.label);
  if (v !== null) rename(win, tab, v.trim());
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "tabs.rename", label: "Rename tab", run: w => ask(w, w.gBrowser.selectedTab) });
  },
  window(win, scope) {
    const strip = win.gBrowser.tabContainer;
    addToPopup(scope, win, "tabContextMenu", h(win.document, "menuitem", {
      id: "vfx-rename-tab", label: "Rename Tab…", oncommand: () => ask(win, contextTab(win)),
    }), "context_duplicateTab");
    // Firefox rewrites the label on every title change; put ours back.
    scope.listen(strip, "TabAttrModified", e => {
      if (e.detail?.changed?.includes("label")) apply(win, e.target);
    });
    scope.listen(strip, "SSTabRestoring", e => apply(win, e.target));
    for (const tab of win.gBrowser.tabs) apply(win, tab);
    scope.add(() => {
      for (const tab of win.gBrowser.tabs) {
        if (tab.hasAttribute("vfx-renamed")) {
          tab.removeAttribute("vfx-renamed");
          try { win.gBrowser.setTabTitle(tab); } catch {}
        }
      }
    });
    // Automation hook (also used by the test-suite).
    win.vfxRenameTab = (tab, name) => rename(win, tab, name);
    scope.add(() => delete win.vfxRenameTab);
  },
};
