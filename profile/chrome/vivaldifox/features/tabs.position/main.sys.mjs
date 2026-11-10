/* MPL-2.0. T1: tab bar position (top / bottom / left / right).
 *
 * left / right  -> Firefox's native vertical tabs (prefs only: most durable).
 * bottom        -> the real #TabsToolbar node is moved below the page area.
 *                  It stays a registered CustomizableUI toolbar, so tabs,
 *                  drag-and-drop and customization keep working. The window
 *                  controls then come from the navigation bar's own (normally
 *                  hidden) button box, the one Firefox uses for vertical tabs.
 * Known limits of "bottom": the tab bar no longer doubles as the title bar,
 * and if the navigation bar is also moved to the bottom (nav.bottom) there is
 * no bar left at the top to hold the window controls: enable Firefox's
 * "Title Bar" checkbox in Customize mode in that combination.
 */
import { moveBelowPage } from "../../core/relocate.sys.mjs";

export default {
  start(scope, ctx) {
    const pos = ctx.opt("position");
    if (pos === "left" || pos === "right") {
      scope.nativePref("sidebar.revamp", true);
      scope.nativePref("sidebar.verticalTabs", true);
      scope.nativePref("sidebar.position_start", pos === "left");
    }
  },
  window(win, scope, ctx) {
    if (ctx.opt("position") !== "bottom") return;
    const doc = win.document;
    const bar = doc.getElementById("TabsToolbar"), browser = doc.getElementById("browser");
    if (!bar || !browser?.parentNode) throw new Error("#TabsToolbar or #browser not found");
    // Directly below the page; restored to its original toolbox slot on disable.
    moveBelowPage(scope, win, bar);
    scope.attr(doc.documentElement, "vfx-tabs-bottom", "true");
    // The bar carries flex="1", which the platform sheet maps to `flex: 1`
    // with a priority author CSS cannot beat. Inside the toolbox that is
    // harmless; next to the page it would take half the window, so the
    // attribute is parked while the bar lives at the bottom.
    const flex = bar.getAttribute("flex");
    if (flex !== null) {
      bar.removeAttribute("flex");
      scope.add(() => bar.setAttribute("flex", flex));
    }
  },
};
