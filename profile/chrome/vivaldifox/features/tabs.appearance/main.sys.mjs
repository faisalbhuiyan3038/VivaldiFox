/* MPL-2.0. T16: tab appearance options. The CSS keys off root attributes set here.
 *
 * Vertical tabs: Firefox's native vertical tab list is restyled (Arc-inspired:
 * roomy rounded rows, a raised "card" for the selected tab, pinned tabs as a
 * tile grid, the page as a rounded inset card). It only applies while native
 * vertical tabs are on (sidebar.verticalTabs), whichever feature or setting
 * turned them on, and follows that pref live. */
const VERTICAL = "sidebar.verticalTabs";
const START = "sidebar.position_start";

export default {
  start(scope, ctx) {
    const w = ctx.opt("minWidth");
    if (w > 0) scope.nativePref("browser.tabs.tabMinWidth", Math.max(50, Math.min(w, 400)));
  },
  window(win, scope, ctx) {
    const root = win.document.documentElement;
    scope.attr(root, "vfx-tab-close", ctx.opt("closeButton"));
    if (ctx.opt("unreadIndicator")) {
      // Firefox dropped its own "notselectedsinceload" attribute, so unread
      // state is tracked here: a tab whose title or load state changes while
      // it is in the background is unread until it is next selected.
      scope.attr(root, "vfx-tab-unread", "true");
      const strip = win.gBrowser.tabContainer;
      const mark = tab => { if (!tab.selected) tab.setAttribute("vfx-unread", "true"); };
      scope.listen(strip, "TabOpen", e => mark(e.target));
      scope.listen(strip, "TabAttrModified", e => {
        const c = e.detail?.changed || [];
        if (c.includes("label") || c.includes("busy")) mark(e.target);
      });
      scope.listen(strip, "TabSelect", e => e.target.removeAttribute("vfx-unread"));
      scope.add(() => { for (const t of win.gBrowser.tabs) t.removeAttribute("vfx-unread"); });
    }
    if (ctx.opt("activeBold")) scope.attr(root, "vfx-tab-bold", "true");

    const style = ctx.opt("verticalStyle");
    if (style !== "default") {
      scope.attr(root, "vfx-vtab-style", style);
      if (ctx.opt("floatingPage")) scope.attr(root, "vfx-vtab-float", "true");
      if (ctx.opt("favoritesGrid")) scope.attr(root, "vfx-vtab-grid", "true");
      const sync = () => {
        const vertical = Services.prefs.getBoolPref(VERTICAL, false);
        if (vertical) root.setAttribute("vfx-vtabs", Services.prefs.getBoolPref(START, true) ? "start" : "end");
        else root.removeAttribute("vfx-vtabs");
      };
      scope.pref(VERTICAL, sync);
      scope.pref(START, sync);
      scope.add(() => root.removeAttribute("vfx-vtabs"));
      sync();
    }
  },
};
