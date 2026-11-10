/* MPL-2.0. A7: image loading toggle (all / no third-party / none).
 * Firefox has no per-tab image switch, so this drives the global
 * permissions.default.image pref. Vivaldi's "cached images only" mode has no
 * Firefox equivalent and is not offered. */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";

const PREF = "permissions.default.image";
const MODES = [[1, "Show All Images"], [3, "Block Third-Party Images"], [2, "Block All Images"]];

export default {
  start(scope, ctx) {
    const hadUser = Services.prefs.prefHasUserValue(PREF);
    const original = Services.prefs.getIntPref(PREF, 1);
    let touched = false;

    const set = (mode, win) => {
      Services.prefs.setIntPref(PREF, mode);
      touched = true;
      if (ctx.opt("reloadOnChange")) win?.gBrowser.selectedBrowser.reload();
    };
    const refresh = () => {
      const blocked = Services.prefs.getIntPref(PREF, 1) !== 1;
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        const node = win.document.getElementById("vfx-images");
        if (node) node.style.listStyleImage = `url("${icon(blocked ? "imageoff" : "image")}")`;
      }
    };
    scope.pref(PREF, refresh);
    // Leave the user's own setting exactly as it was when the feature is turned off.
    scope.add(() => {
      if (!touched) return;
      if (hadUser) Services.prefs.setIntPref(PREF, original);
      else Services.prefs.clearUserPref(PREF);
    });

    menuWidget(ctx, scope, {
      id: "vfx-images", label: "Images", tooltip: "Image loading", icon: icon("image"),
      onCreated: () => Services.tm.dispatchToMainThread(refresh),
      populate(popup, win) {
        const cur = Services.prefs.getIntPref(PREF, 1);
        for (const [mode, label] of MODES) {
          popup.append(h(win.document, "menuitem", { type: "radio", label, checked: cur === mode, oncommand: () => set(mode, win) }));
        }
      },
    });
    ctx.Commands.register(scope, {
      id: "page.toggleImages", label: "Toggle image loading",
      run: w => set(Services.prefs.getIntPref(PREF, 1) === 1 ? 2 : 1, w),
    });
  },
};
