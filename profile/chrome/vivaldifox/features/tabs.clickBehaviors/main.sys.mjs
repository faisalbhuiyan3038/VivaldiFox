/* MPL-2.0. T12: Vivaldi-style tab click and wheel behaviours. */
export default {
  start(scope, ctx) {
    // Two of the three behaviours are native Firefox prefs.
    if (ctx.opt("doubleClickClose")) scope.nativePref("browser.tabs.closeTabByDblclick", true);
    if (ctx.opt("wheelSwitch")) scope.nativePref("toolkit.tabbox.switchByScrolling", true);
  },
  window(win, scope, ctx) {
    if (!ctx.opt("activeToPrevious")) return;
    // "Click the active tab to go back to the previously active one."
    const gB = win.gBrowser, strip = gB.tabContainer;
    let previous = null, armed = null;
    scope.listen(strip, "TabSelect", e => { previous = e.detail?.previousTab || null; });
    scope.listen(strip, "mousedown", e => {
      const tab = e.target.closest?.(".tabbrowser-tab");
      const plain = e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey;
      const onControl = e.target.closest?.(".tab-close-button, .tab-audio-button, .tab-icon-overlay");
      armed = tab && tab.selected && plain && !onControl ? { tab, x: e.screenX, y: e.screenY } : null;
    }, true);
    scope.listen(strip, "click", e => {
      const a = armed;
      armed = null;
      if (!a || e.button !== 0 || e.detail > 1) return;
      // Ignore drags (tab reordering).
      if (Math.abs(e.screenX - a.x) > 4 || Math.abs(e.screenY - a.y) > 4) return;
      if (e.target.closest?.(".tabbrowser-tab") !== a.tab) return;
      if (previous?.isConnected && !previous.closing && !previous.hidden) gB.selectedTab = previous;
    });
  },
};
