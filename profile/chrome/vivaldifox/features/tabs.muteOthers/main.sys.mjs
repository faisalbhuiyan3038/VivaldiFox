/* MPL-2.0. T14: mute other tabs, and optional "audio in active tab only". */
import { h, addToPopup, contextTab } from "../../core/ui.sys.mjs";

const REASON = "vivaldifox";
const live = t => t.linkedPanel && !t.hasAttribute("pending");
const mute = t => { if (live(t) && !t.linkedBrowser.audioMuted) t.toggleMuteAudio(REASON); };
const unmute = t => { if (live(t) && t.linkedBrowser.audioMuted && t.muteReason === REASON) t.toggleMuteAudio(REASON); };

function muteOthers(win, keep) {
  for (const t of win.gBrowser.tabs) if (t !== keep) mute(t);
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "tabs.muteOthers", label: "Mute other tabs", run: w => muteOthers(w, w.gBrowser.selectedTab) });
    ctx.Commands.register(scope, { id: "tabs.unmuteAll", label: "Unmute tabs muted by VivaldiFox", run: w => w.gBrowser.tabs.forEach(unmute) });
  },
  window(win, scope, ctx) {
    addToPopup(scope, win, "tabContextMenu", h(win.document, "menuitem", {
      id: "vfx-mute-others", label: "Mute Other Tabs", oncommand: () => muteOthers(win, contextTab(win)),
    }), "context_toggleMuteTab");
    if (!ctx.opt("activeOnly")) return;
    const syncAll = () => {
      const sel = win.gBrowser.selectedTab;
      unmute(sel);
      muteOthers(win, sel);
    };
    scope.listen(win.gBrowser.tabContainer, "TabSelect", syncAll);
    // Tabs that start playing in the background get muted too.
    scope.listen(win.gBrowser.tabContainer, "TabAttrModified", e => {
      if (e.detail?.changed?.includes("soundplaying") && !e.target.selected) mute(e.target);
    });
    syncAll();
    scope.add(() => win.gBrowser.tabs.forEach(unmute));
  },
};
