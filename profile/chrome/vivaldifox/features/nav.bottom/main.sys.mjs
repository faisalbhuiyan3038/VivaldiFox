/* MPL-2.0. A5: address bar (navigation toolbar) at the bottom of the window.
 *
 * The real #nav-bar node is moved below the page area and stays a registered
 * toolbar. The address-bar results list is flipped with CSS so it opens
 * upwards. This is the most layout-sensitive feature after two-level tabs:
 * the urlbar's internal structure has changed several times, so the flip is
 * written against the two oldest hooks (#urlbar and .urlbarView) and degrades
 * to "results open downwards, possibly clipped" if those ever change.
 */
import { moveBelowPage } from "../../core/relocate.sys.mjs";

export default {
  window(win, scope) {
    const doc = win.document;
    const bar = doc.getElementById("nav-bar"), browser = doc.getElementById("browser");
    if (!bar || !browser?.parentNode) throw new Error("#nav-bar or #browser not found");
    moveBelowPage(scope, win, bar);
    scope.attr(doc.documentElement, "vfx-nav-bottom", "true");
  },
};
