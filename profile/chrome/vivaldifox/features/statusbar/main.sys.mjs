/* MPL-2.0. S1: a real, customizable status bar at the bottom of the window.
 *
 * It is registered with CustomizableUI as an ordinary toolbar area, so any
 * button (Firefox's, an extension's, or this mod's) can be dragged into it in
 * Customize mode. The node is appended after #browser in <body>, which is the
 * one structural assumption; if #browser is ever missing the feature reports
 * failure instead of guessing.
 */
import { h } from "../../core/ui.sys.mjs";

export const AREA = "vfx-statusbar";

export default {
  start(scope, ctx) {
    const CUI = ctx.CustomizableUI;
    try { CUI.unregisterArea(AREA, false); } catch {}
    CUI.registerArea(AREA, { type: CUI.TYPE_TOOLBAR, defaultPlacements: [] });
    scope.add(() => {
      // Widgets living in the bar belong to other, independent features:
      // hand them to the nav bar so they stay reachable when the bar goes away.
      try {
        for (const id of CUI.getWidgetIdsInArea(AREA)) CUI.addWidgetToArea(id, CUI.AREA_NAVBAR);
      } catch {}
      try { CUI.unregisterArea(AREA, true); } catch {}
    });
  },
  window(win, scope, ctx) {
    const doc = win.document, CUI = ctx.CustomizableUI;
    const anchor = doc.getElementById("browser");
    if (!anchor?.parentNode) throw new Error("#browser container not found");
    const bar = h(doc, "toolbar", {
      id: AREA, class: "browser-toolbar chromeclass-toolbar", customizable: "true", mode: "icons",
      context: "toolbar-context-menu", toolbarname: "Status Bar", "aria-label": "Status Bar",
    });
    bar.append(h(doc, "hbox", { id: "vfx-statusbar-target", class: "customization-target", flex: "1" }));
    anchor.after(bar);
    try { CUI.registerToolbarNode(bar); } catch (e) { console.error("[vivaldifox:statusbar]", e); }
    scope.add(() => bar.remove());
    scope.attr(doc.documentElement, "vfx-statusbar", ctx.opt("compact") ? "compact" : "true");
  },
};
