/* MPL-2.0. D1/D2/D4: Vivaldi-style Start Page (Speed Dial + Bookmarks + History)
 * as the new-tab page and, optionally, the home page.
 *
 * The page is a privileged chrome document (features/startpage/page.html).
 * New-tab override goes through AboutNewTab.newTabURL, the same switch
 * Firefox's own policy engine and extensions use; if that hook is ever
 * removed the feature reports failure and Firefox's new tab stays untouched.
 */
import { Fx } from "../../core/fx.sys.mjs";

export const PAGE_URL = "chrome://vivaldifox/content/features/startpage/page.html";

export default {
  start(scope, ctx) {
    const ANT = Fx.AboutNewTab;
    if (!("newTabURL" in ANT)) throw new Error("AboutNewTab.newTabURL is not available");
    const hadOverride = ANT.newTabURLOverridden;
    const previous = hadOverride ? ANT.newTabURL : null;
    ANT.newTabURL = PAGE_URL;
    scope.add(() => {
      // Restore exactly what was there (another extension's override, or the default).
      if (hadOverride && previous) ANT.newTabURL = previous;
      else ANT.resetNewTabURL();
    });
    if (ctx.opt("setHome")) scope.nativePref("browser.startup.homepage", PAGE_URL);
    ctx.Commands.register(scope, { id: "startpage.open", label: "Open Start Page", run: w => w.openTrustedLinkIn(PAGE_URL, "tab") });
    // Open start pages pick up option changes and close when the feature is turned off.
    scope.add(() => {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        for (const tab of win.gBrowser?.tabs || []) {
          if (tab.linkedBrowser?.currentURI?.spec === PAGE_URL) {
            try { tab.linkedBrowser.loadURI(Services.io.newURI("about:blank"), { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); } catch {}
          }
        }
      }
    });
  },
};
