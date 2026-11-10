/* MPL-2.0. L3: corner rounding. One radius for tabs, fields, buttons and popups. */
export default {
  window(win, scope, ctx) {
    const r = Math.max(0, Math.min(ctx.opt("radius"), 24));
    const root = win.document.documentElement;
    scope.cssVar(root, "--vfx-radius", r + "px");
    scope.attr(root, "vfx-rounding", "true");
    // Firefox's own design tokens, where they exist; harmless where they do not.
    for (const v of ["--tab-border-radius", "--toolbarbutton-border-radius", "--arrowpanel-border-radius", "--urlbar-border-radius", "--border-radius-small", "--border-radius-medium"]) {
      scope.cssVar(root, v, r + "px");
    }
  },
};
