/* MPL-2.0. L5: hide the user interface. A command/shortcut (default Ctrl+F11)
 * hides all toolbars; with "reveal on hover" the toolbars slide back in while
 * the pointer is at the top edge or the address bar has focus. With vertical
 * tabs the sidebar hides too and, with "reveal on hover", slides in from its
 * own edge (shared engine in core/sidebarPeek.sys.mjs; inert with horizontal
 * tabs). */
import { comboOf, normalizeCombo } from "../../core/keys.sys.mjs";
import { SidebarPeek } from "../../core/sidebarPeek.sys.mjs";

/** Shared across windows so the toggle is global, like Vivaldi's. */
let hidden = false;
const listeners = new Set();

function setHidden(v) {
  hidden = v;
  for (const fn of listeners) fn();
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "look.toggleUI", label: "Toggle user interface", run: () => setHidden(!hidden) });
    if (ctx.opt("startHidden")) hidden = true;
    scope.add(() => { hidden = false; });
  },
  window(win, scope, ctx) {
    const doc = win.document, root = doc.documentElement;
    const toolbox = doc.getElementById("navigator-toolbox");
    if (!toolbox) throw new Error("#navigator-toolbox not found");
    const mode = ctx.opt("revealOnHover") ? "hover" : "full";
    let sidebar = null; // child scope holding the sidebar request while hidden
    const apply = () => {
      if (hidden) root.setAttribute("vfx-ui-hidden", mode);
      else root.removeAttribute("vfx-ui-hidden");
      if (hidden && !sidebar) {
        sidebar = scope.child();
        // The toolbars hide even if the sidebar part fails in some Firefox version.
        try { SidebarPeek.request(sidebar, win, { mode: mode === "hover" ? "hidden" : "gone", priority: 20, peekOnSwitch: false }); } catch (e) { console.error("[vivaldifox:look.autohide] sidebar", e); }
      } else if (!hidden && sidebar) {
        sidebar.dispose();
        sidebar = null;
      }
    };
    listeners.add(apply);
    scope.add(() => { listeners.delete(apply); root.removeAttribute("vfx-ui-hidden"); });

    // The slide-out distance must equal the real toolbox height.
    const ro = new win.ResizeObserver(() => root.style.setProperty("--vfx-toolbox-height", toolbox.getBoundingClientRect().height + "px"));
    ro.observe(toolbox);
    scope.add(() => { ro.disconnect(); root.style.removeProperty("--vfx-toolbox-height"); });

    // Keep the toolbars visible while one of their menus or panels is open.
    const onPopup = e => {
      if (!hidden) return;
      const t = e.target;
      if (t?.localName !== "menupopup" && t?.localName !== "panel") return;
      if (e.type === "popupshown") root.setAttribute("vfx-ui-popup", "true");
      else root.removeAttribute("vfx-ui-popup");
    };
    scope.listen(doc, "popupshown", onPopup);
    scope.listen(doc, "popuphidden", onPopup);
    scope.add(() => root.removeAttribute("vfx-ui-popup"));

    const hotkey = normalizeCombo(ctx.opt("key"));
    scope.listen(win, "keydown", e => {
      if (hotkey && comboOf(e) === hotkey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setHidden(!hidden);
      }
    }, true);
    apply();
    win.vfxAutohide = { set: setHidden, get hidden() { return hidden; } };
    scope.add(() => delete win.vfxAutohide);
  },
};
