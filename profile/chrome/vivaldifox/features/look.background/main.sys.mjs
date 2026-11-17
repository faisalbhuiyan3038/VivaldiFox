/* MPL-2.0. L4: window background image with translucent toolbars.
 *
 * The image is painted once, on the window itself, sized to the whole window.
 * Earlier it sat on the toolbox, which made it re-crop whenever the toolbox
 * changed height (bookmarks bar, hidden UI) and left vertical tabs, panels and
 * the status bar opaque. Every bar now uses one translucency rule, including
 * the selected tab, which used to stay opaque and stand out as a solid block. */
const pct = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(Number(v) || 0, hi)) + "%";

export default {
  window(win, scope, ctx) {
    const raw = String(ctx.opt("image") || "").trim();
    if (!raw) return; // nothing configured: feature is on but inert
    let url = raw;
    // Accept a local path as well as a URL.
    if (!/^[a-z-]+:/i.test(raw) || /^[a-z]:[\\/]/i.test(raw)) {
      try { url = PathUtils.toFileURI(raw); } catch { return; }
    }
    const root = win.document.documentElement;
    scope.cssVar(root, "--vfx-window-bg", `url("${url.replace(/["\\]/g, encodeURIComponent)}")`);
    scope.cssVar(root, "--vfx-toolbar-opacity", pct(ctx.opt("toolbarOpacity")));
    scope.cssVar(root, "--vfx-tabbar-opacity", pct(ctx.opt("tabbarOpacity")));
    scope.cssVar(root, "--vfx-field-opacity", pct(ctx.opt("fieldOpacity"), 20));
    scope.attr(root, "vfx-window-bg", "true");
  },
};
