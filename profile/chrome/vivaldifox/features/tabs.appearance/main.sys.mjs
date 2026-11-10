/* MPL-2.0. T16: tab appearance options. The CSS keys off root attributes set here. */
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
  },
};
