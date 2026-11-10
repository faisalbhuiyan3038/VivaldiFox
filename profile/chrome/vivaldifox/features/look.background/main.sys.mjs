/* MPL-2.0. L4: window background image with translucent toolbars. */
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
    scope.cssVar(root, "--vfx-toolbar-opacity", Math.max(0, Math.min(ctx.opt("toolbarOpacity"), 100)) + "%");
    scope.attr(root, "vfx-window-bg", "true");
  },
};
