/* MPL-2.0. T5: tab tiling (two tabs side by side) on top of Firefox's native
 * Split View. Adds Vivaldi-style commands, a tab context item and a button.
 * Grids of three or more tabs are out of scope (see README). */
import { h, icon, addToPopup, contextTab } from "../../core/ui.sys.mjs";

function tile(win, anchor) {
  const gB = win.gBrowser;
  if (typeof gB.addTabSplitView !== "function") throw new Error("Split View is not available in this Firefox");
  const first = anchor || gB.selectedTab;
  if (first.splitview) return null; // already tiled
  // Prefer an explicit multi-selection; otherwise pair with the neighbouring tab.
  const usable = t => t && !t.pinned && !t.splitview && !t.closing && !t.hidden;
  let pair = gB.selectedTabs?.length >= 2 && gB.selectedTabs.includes(first) ? gB.selectedTabs.filter(usable).slice(0, 2) : null;
  if (!pair || pair.length < 2) {
    const visible = gB.visibleTabs || gB.tabs;
    const i = visible.indexOf(first);
    const other = [visible[i + 1], visible[i - 1]].find(usable);
    if (!usable(first) || !other) return null;
    pair = visible.indexOf(other) > i ? [first, other] : [other, first];
  }
  return gB.addTabSplitView(pair);
}

function untile(win, anchor) {
  const gB = win.gBrowser;
  const sv = (anchor || gB.selectedTab).splitview || gB.activeSplitView;
  if (!sv) return false;
  if (typeof sv.unsplitTabs === "function") sv.unsplitTabs();
  else win.document.getElementById("splitViewCmd_separateTabs")?.doCommand();
  return true;
}

export default {
  start(scope, ctx) {
    scope.nativePref("browser.tabs.splitView.enabled", true);
    ctx.Commands.register(scope, { id: "tabs.tile", label: "Tile tabs side by side", run: w => tile(w) });
    ctx.Commands.register(scope, { id: "tabs.untile", label: "Untile tabs", run: w => untile(w) });
    ctx.Commands.register(scope, { id: "tabs.tileToggle", label: "Toggle tab tiling", run: w => (w.gBrowser.selectedTab.splitview ? untile(w) : tile(w)) });
    ctx.widget(scope, {
      id: "vfx-tile", label: "Tile Tabs", tooltip: "Tile this tab with its neighbour / untile", icon: icon("tile"),
      onCommand: (_e, w) => (w.gBrowser.selectedTab.splitview ? untile(w) : tile(w)),
    });
  },
  window(win, scope) {
    addToPopup(scope, win, "tabContextMenu", h(win.document, "menuitem", {
      id: "vfx-tile-tab", label: "Tile / Untile Tab",
      oncommand: () => { const t = contextTab(win); t.splitview ? untile(win, t) : tile(win, t); },
    }), "context_duplicateTab");
    win.vfxTiling = { tile: t => tile(win, t), untile: t => untile(win, t) };
    scope.add(() => delete win.vfxTiling);
  },
};
