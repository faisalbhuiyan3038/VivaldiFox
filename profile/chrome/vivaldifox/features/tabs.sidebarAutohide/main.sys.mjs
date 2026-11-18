/* MPL-2.0. Auto-hide for Firefox's native vertical tabs, Arc / Vivaldi style.
 * All the behaviour lives in the shared engine (core/sidebarPeek.sys.mjs);
 * this feature only asks for a mode and handles pin / unpin. Inert while tabs
 * are horizontal: it follows sidebar.verticalTabs live. */
import { SidebarPeek } from "../../core/sidebarPeek.sys.mjs";
import { comboOf, normalizeCombo } from "../../core/keys.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";

/** Pin / unpin; set in start(), used by every window. */
let toggle = () => {};

export default {
  start(scope, ctx) {
    toggle = win => {
      const pinned = !ctx.opt("pinned");
      ctx.setOpt("pinned", pinned);
      if (win && Services.prefs.getBoolPref("sidebar.verticalTabs", false)) toast(win, pinned ? "Sidebar pinned" : "Sidebar auto-hides", 1200);
    };
    ctx.Commands.register(scope, { id: "tabs.toggleSidebarPin", label: "Pin / unpin the sidebar (vertical tabs)", run: toggle });
    ctx.Commands.register(scope, { id: "tabs.peekSidebar", label: "Peek at the sidebar (vertical tabs)", run: w => w.vfxSidebarAutohide?.peek(1500) });
    scope.add(() => { toggle = () => {}; });
  },
  window(win, scope, ctx) {
    const req = () => {
      const delay = ctx.opt("revealDelay");
      return {
        mode: ctx.opt("pinned") ? "docked" : ctx.opt("mode"),
        revealDelay: delay >= 0 ? delay : undefined,
        hideDelay: Math.max(0, ctx.opt("hideDelay")),
        peekOnSwitch: ctx.opt("peekOnSwitch"),
      };
    };
    const handle = SidebarPeek.request(scope, win, { priority: 10, ...req(), onToggle: () => toggle(win) });
    // All options are live: re-read them whenever one changes.
    scope.pref("vivaldifox.tabs.sidebarAutohide.", () => handle.set(req()));
    const hotkey = normalizeCombo(ctx.opt("key"));
    scope.listen(win, "keydown", e => {
      if (hotkey && comboOf(e) === hotkey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle(win);
      }
    }, true);
    win.vfxSidebarAutohide = { peek: ms => handle.peek(ms), get state() { return handle.state; } };
    scope.add(() => delete win.vfxSidebarAutohide);
  },
};
