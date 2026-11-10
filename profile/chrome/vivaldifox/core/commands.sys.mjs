/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Command registry: always-present shared infrastructure.
 *
 * Mouse gestures, keyboard shortcuts, quick commands and command chains all
 * need "a named thing the browser can do". Instead of those features
 * depending on each other, they each consume this registry. It is seeded with
 * wrappers around Firefox's own <command> elements; features add their own
 * commands while enabled and remove them when disabled.
 *
 * Built-ins reference Firefox command ids. Those ids have been stable for
 * many years, but each is resolved lazily and a missing one is simply
 * reported as unavailable instead of throwing.
 */
const registry = new Map();

/** [id, label, firefox <command> id | function(win)] */
const BUILTINS = [
  ["back", "Back", "Browser:Back"],
  ["forward", "Forward", "Browser:Forward"],
  ["reload", "Reload", "Browser:Reload"],
  ["reloadHard", "Reload (skip cache)", "Browser:ReloadSkipCache"],
  ["stop", "Stop loading", "Browser:Stop"],
  ["home", "Home", "Browser:Home"],
  ["newTab", "New tab", "cmd_newNavigatorTab"],
  ["closeTab", "Close tab", "cmd_close"],
  ["reopenTab", "Reopen closed tab", "History:UndoCloseTab"],
  ["newWindow", "New window", "cmd_newNavigator"],
  ["newPrivateWindow", "New private window", "Tools:PrivateBrowsing"],
  ["closeWindow", "Close window", "cmd_closeWindow"],
  ["nextTab", "Next tab", "Browser:NextTab"],
  ["prevTab", "Previous tab", "Browser:PrevTab"],
  ["firstTab", "First tab", w => w.gBrowser.selectTabAtIndex(0)],
  ["lastTab", "Last tab", w => w.gBrowser.selectTabAtIndex(-1)],
  ["duplicateTab", "Duplicate tab", w => w.gBrowser.duplicateTab(w.gBrowser.selectedTab)],
  ["pinTab", "Pin / unpin tab", w => {
    const t = w.gBrowser.selectedTab;
    t.pinned ? w.gBrowser.unpinTab(t) : w.gBrowser.pinTab(t);
  }],
  ["muteTab", "Mute / unmute tab", w => w.gBrowser.selectedTab.toggleMuteAudio()],
  ["zoomIn", "Zoom in", "cmd_fullZoomEnlarge"],
  ["zoomOut", "Zoom out", "cmd_fullZoomReduce"],
  ["zoomReset", "Reset zoom", "cmd_fullZoomReset"],
  ["fullscreen", "Toggle fullscreen", "View:FullScreen"],
  ["readerView", "Toggle reader view", "View:ReaderView"],
  ["find", "Find in page", "cmd_find"],
  ["focusUrlbar", "Focus address bar", "Browser:OpenLocation"],
  ["focusSearch", "Search the web", "Tools:Search"],
  ["bookmarkPage", "Bookmark this page", "Browser:AddBookmarkAs"],
  ["showBookmarks", "Manage bookmarks", "Browser:ShowAllBookmarks"],
  ["showHistory", "Manage history", "Browser:ShowAllHistory"],
  ["showDownloads", "Show downloads", "Tools:Downloads"],
  ["showAddons", "Add-ons and themes", "Tools:Addons"],
  ["print", "Print", "cmd_print"],
  ["savePage", "Save page as", "Browser:SavePage"],
  ["viewSource", "View page source", "View:PageSource"],
  ["pictureInPicture", "Picture-in-picture", "View:PictureInPicture"],
  ["scrollTop", "Scroll to top", w => w.goDoCommand("cmd_scrollTop")],
  ["scrollBottom", "Scroll to bottom", w => w.goDoCommand("cmd_scrollBottom")],
  ["scrollPageUp", "Scroll page up", w => w.goDoCommand("cmd_scrollPageUp")],
  ["scrollPageDown", "Scroll page down", w => w.goDoCommand("cmd_scrollPageDown")],
  ["copy", "Copy", w => w.goDoCommand("cmd_copy")],
  ["paste", "Paste", w => w.goDoCommand("cmd_paste")],
  ["toggleSidebar", "Toggle sidebar", w => w.SidebarController?.toggle()],
  ["preferences", "Firefox settings", w => w.openPreferences()],
  ["minimize", "Minimize window", w => w.minimize()],
  ["none", "Do nothing", () => {}],
];

for (const [id, label, target] of BUILTINS) {
  registry.set(id, {
    id, label, group: "Firefox",
    available: w => typeof target === "function" || !!w.document.getElementById(target),
    run: w => {
      if (typeof target === "function") return target(w);
      const el = w.document.getElementById(target);
      if (!el) throw new Error(`Firefox command ${target} no longer exists`);
      el.doCommand();
    },
  });
}

export const Commands = {
  /**
   * Register a command for the lifetime of `scope`.
   * @param {Scope} scope
   * @param {{id:string,label:string,run:function(Window):any,group?:string}} cmd
   */
  register(scope, cmd) {
    registry.set(cmd.id, { group: "VivaldiFox", available: () => true, ...cmd });
    scope.add(() => registry.delete(cmd.id));
  },

  get(id) { return registry.get(id); },

  /** All commands usable in `win`. */
  list(win) {
    return [...registry.values()].filter(c => {
      try { return !win || c.available(win); } catch { return false; }
    });
  },

  /** Run a command by id. Never throws; returns false if it could not run. */
  run(id, win) {
    const c = registry.get(id);
    if (!c) {
      console.warn("[vivaldifox] unknown command", id);
      return false;
    }
    try {
      c.run(win);
      return true;
    } catch (e) {
      console.error("[vivaldifox] command", id, e);
      return false;
    }
  },
};
