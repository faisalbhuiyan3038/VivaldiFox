/* MPL-2.0. L3: user-interface zoom. Scales the browser chrome only (toolbars,
 * tabs, menus) and leaves web pages at their own zoom, unlike the global
 * layout.css.devPixelsPerPx pref which scales everything. */
export default {
  window(win, scope, ctx) {
    const pct = Math.max(50, Math.min(ctx.opt("percent"), 200));
    const bc = win.browsingContext;
    if (!bc || !("fullZoom" in bc)) throw new Error("BrowsingContext.fullZoom is not available");
    const before = bc.fullZoom;
    bc.fullZoom = pct / 100;
    scope.add(() => { try { bc.fullZoom = before; } catch {} });
  },
};
