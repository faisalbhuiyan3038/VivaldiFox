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

  // ── Tabs ──
  ["closeOtherTabs", "Close other tabs", w => w.gBrowser.removeAllTabsBut(w.gBrowser.selectedTab)],
  ["closeTabsRight", "Close tabs to the right", w => w.gBrowser.removeTabsToTheEndFrom(w.gBrowser.selectedTab)],
  ["closeTabsLeft", "Close tabs to the left", w => w.gBrowser.removeTabsToTheStartFrom(w.gBrowser.selectedTab), w => typeof w.gBrowser.removeTabsToTheStartFrom === "function"],
  ["reloadAllTabs", "Reload all tabs", w => w.gBrowser.reloadTabs(w.gBrowser.visibleTabs)],
  ["moveTabLeft", "Move tab left", w => w.gBrowser.moveTabBackward()],
  ["moveTabRight", "Move tab right", w => w.gBrowser.moveTabForward()],
  ["moveTabStart", "Move tab to start", w => w.gBrowser.moveTabToStart()],
  ["moveTabEnd", "Move tab to end", w => w.gBrowser.moveTabToEnd()],
  ["moveTabNewWindow", "Move tab to new window", w => w.gBrowser.replaceTabsWithWindow(w.gBrowser.selectedTab)],
  ["unloadTab", "Unload (hibernate) this tab", w => unloadSelected(w)],
  ["selectAllTabs", "Select all tabs", w => w.gBrowser.selectAllTabs()],
  ["bookmarkAllTabs", "Bookmark all tabs", "Browser:BookmarkAllTabs"],
  ["restoreSession", "Restore previous session", "Browser:RestoreLastSession"],

  // ── Page ──
  ["copyUrl", "Copy page address", w => copy(w.gBrowser.currentURI.displaySpec)],
  ["copyTitle", "Copy page title", w => copy(w.gBrowser.selectedTab.label)],
  ["copyMarkdownLink", "Copy page as Markdown link", w => copy(`[${w.gBrowser.selectedTab.label.replace(/[[\]]/g, "\\$&")}](${w.gBrowser.currentURI.displaySpec})`)],
  ["pasteAndGo", "Paste and go", w => pasteAndGo(w), w => typeof w.readFromClipboard === "function"],
  ["goUp", "Go up one level in the address", w => goUp(w, false)],
  ["goRoot", "Go to the site's root", w => goUp(w, true)],
  ["screenshot", "Take a screenshot", "Browser:Screenshot"],
  ["pageInfo", "Page info", "View:PageInfo"],
  ["toggleCaretBrowsing", "Toggle caret browsing", () => togglePref("accessibility.browsewithcaret")],
  ["translatePage", "Translate page", w => w.FullPageTranslationsPanel.open(new w.CustomEvent("command")), w => !!w.FullPageTranslationsPanel?.open],

  // ── Developer ──
  // DevTools fills the Web Developer menu only when it is about to open.
  ["devTools", "Toggle developer tools", devMenu("menu_devToolbox"), devAvail],
  ["browserConsole", "Browser console", devMenu("menu_browserConsole"), devAvail],
  ["responsiveDesign", "Responsive design mode", devMenu("menu_responsiveUI"), devAvail],
  ["eyedropper", "Eyedropper (pick a colour)", devMenu("menu_eyedropper"), devAvail],

  // ── Window & interface ──
  ["toggleBookmarksToolbar", "Toggle bookmarks toolbar", w => toggleToolbar(w, "PersonalToolbar")],
  ["toggleMenubar", "Toggle menu bar", w => toggleToolbar(w, "toolbar-menubar")],
  ["customize", "Customize toolbar", "cmd_CustomizeToolbars"],
  ["toggleVerticalTabs", "Toggle vertical tabs", () => togglePref("sidebar.verticalTabs")],
  ["toggleSidebarExpanded", "Expand / collapse the sidebar", w => w.SidebarController.handleToolbarButtonClick(), w => typeof w.SidebarController?.handleToolbarButtonClick === "function"],
  ["sidebarBookmarks", "Bookmarks sidebar", w => w.SidebarController.toggle("viewBookmarksSidebar"), w => !!w.SidebarController],
  ["sidebarHistory", "History sidebar", w => w.SidebarController.toggle("viewHistorySidebar"), w => !!w.SidebarController],
  ["sidebarSyncedTabs", "Synced tabs sidebar", w => w.SidebarController.toggle("viewTabsSidebar"), w => !!w.SidebarController],
  ["openFile", "Open file…", "Browser:OpenFile"],
  ["workOffline", "Toggle work offline", w => w.BrowserOffline?.toggleOfflineStatus(), w => !!w.BrowserOffline],

  // ── Data & privacy ──
  ["clearHistory", "Clear recent history…", "Tools:Sanitize"],
  ["syncNow", "Sync now", w => w.gSync.doSync(), w => typeof w.gSync?.doSync === "function"],
  ["passwords", "Passwords", w => openAbout(w, "about:logins")],

  // ── Internal pages ──
  ["aboutConfig", "Advanced preferences (about:config)", w => openAbout(w, "about:config")],
  ["aboutProcesses", "Process manager (about:processes)", w => openAbout(w, "about:processes")],
  ["aboutProfiles", "Profiles (about:profiles)", w => openAbout(w, "about:profiles")],
  ["aboutSupport", "Troubleshooting information", w => openAbout(w, "about:support")],
  ["aboutMemory", "Memory (about:memory)", w => openAbout(w, "about:memory")],
  ["aboutDownloads", "Downloads page", w => openAbout(w, "about:downloads")],

  ["none", "Do nothing", () => {}],
];

// ── Helpers used by the built-ins ──
function copy(text) {
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(String(text));
}
function togglePref(name) {
  Services.prefs.setBoolPref(name, !Services.prefs.getBoolPref(name, false));
}
function openAbout(w, url) {
  w.switchToTabHavingURI(url, true, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
}
/** Run the first existing element of `ids` (menu items or keys). */
function menu(...ids) {
  return w => {
    const el = ids.map(id => w.document.getElementById(id)).find(Boolean);
    if (!el) throw new Error(`Firefox elements ${ids.join(", ")} no longer exist`);
    el.doCommand();
  };
}
function devMenu(id) {
  return w => {
    const doc = w.document;
    if (doc.getElementById(id)) return menu(id)(w);
    // First use: this starts DevTools, which adds the items shortly afterwards.
    doc.getElementById("menuWebDeveloperPopup")?.dispatchEvent(new w.Event("popupshowing", { bubbles: true }));
    let tries = 0;
    const wait = () => {
      if (doc.getElementById(id)) menu(id)(w);
      else if (++tries < 40) w.setTimeout(wait, 50);
      else console.error(`[vivaldifox] DevTools menu item ${id} did not appear`);
    };
    wait();
  };
}
function devAvail(w) {
  return !!w.document.getElementById("menuWebDeveloperPopup") && !Services.prefs.getBoolPref("devtools.policy.disabled", false);
}
function toggleToolbar(w, id) {
  const bar = w.document.getElementById(id);
  if (!bar) throw new Error(`#${id} not found`);
  const hidden = id === "toolbar-menubar" ? bar.getAttribute("autohide") === "true" : bar.collapsed;
  w.setToolbarVisibility(bar, hidden);
}
function pasteAndGo(w) {
  const text = String(w.readFromClipboard() || "").trim();
  if (text) w.openTrustedLinkIn(text, "current", { allowThirdPartyFixup: true });
}
function goUp(w, toRoot) {
  const uri = w.gBrowser.currentURI;
  if (!/^(https?|ftp|file)$/.test(uri.scheme)) return;
  const url = new URL(uri.spec);
  // One level at a time, like Vivaldi: first drop ?query and #hash, then a path segment.
  const hadExtra = !!(url.search || url.hash);
  url.hash = "";
  url.search = "";
  if (toRoot) url.pathname = "/";
  else if (!hadExtra) url.pathname = url.pathname.replace(/\/$/, "").replace(/[^/]*$/, "") || "/";
  if (url.href !== uri.spec) w.openTrustedLinkIn(url.href, "current");
}
function unloadSelected(w) {
  const gB = w.gBrowser, tab = gB.selectedTab;
  const others = gB.visibleTabs.filter(t => t !== tab && !t.closing);
  if (!others.length) return;
  const i = others.findIndex(t => t._tPos > tab._tPos);
  gB.selectedTab = others[i >= 0 ? i : others.length - 1];
  gB.discardBrowser(tab);
}

for (const [id, label, target, avail] of BUILTINS) {
  registry.set(id, {
    id, label, group: "Firefox",
    available: w => (avail ? avail(w) : typeof target === "function" || !!w.document.getElementById(target)),
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
