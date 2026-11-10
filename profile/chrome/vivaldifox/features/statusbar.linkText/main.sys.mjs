/* MPL-2.0. S2: status text (hovered link URL, load status) as a toolbar item.
 *
 * The item mirrors Firefox's own floating status panel. While the item is
 * placed in a toolbar of a window, the floating panel is hidden there; when
 * it is not placed (or the feature is off) Firefox's overlay behaves as usual.
 * It is an ordinary widget: the status bar is the natural home, but any
 * toolbar works, so this does not require the status bar feature.
 */
import { h } from "../../core/ui.sys.mjs";

const ID = "vfx-status-text";

export default {
  start(scope, ctx) {
    ctx.widget(scope, {
      id: ID, type: "custom", label: "Status Text", tooltip: "Status text",
      // First placement: the status bar when it is on, otherwise the palette.
      area: ctx.isRunning("statusbar") ? "vfx-statusbar" : null,
      overflows: false,
      onBuild: doc => h(doc, "toolbaritem", { flex: "1", removable: "true", title: "Status Text" }, [
        h(doc, "label", { class: "vfx-status-text-label", crop: "center", flex: "1", value: "" }),
      ]),
    });
  },
  window(win, scope) {
    const doc = win.document;
    const src = doc.getElementById("statuspanel-label");
    if (!src) throw new Error("#statuspanel-label not found");
    const placed = () => {
      const node = doc.getElementById(ID);
      return node?.isConnected && !node.closest("#BrowserToolbarPalette, toolbarpaletteitem[place='palette']") ? node : null;
    };
    const sync = () => {
      const node = placed();
      doc.documentElement.toggleAttribute("vfx-status-text-placed", !!node);
      const label = node?.querySelector(".vfx-status-text-label");
      if (label) {
        const inactive = src.parentNode?.hasAttribute?.("inactive") || doc.getElementById("statuspanel")?.hasAttribute("inactive");
        label.setAttribute("value", inactive ? "" : src.getAttribute("value") || "");
      }
    };
    const mo = new win.MutationObserver(sync);
    mo.observe(src, { attributes: true, attributeFilter: ["value"] });
    const panel = doc.getElementById("statuspanel");
    if (panel) mo.observe(panel, { attributes: true, attributeFilter: ["inactive"] });
    scope.add(() => mo.disconnect());
    // Re-evaluate placement after customization and toolbar changes.
    scope.listen(win, "aftercustomization", sync);
    const cuiListener = { onWidgetAfterDOMChange: sync, onAreaNodeRegistered: sync };
    win.CustomizableUI?.addListener(cuiListener);
    scope.add(() => win.CustomizableUI?.removeListener(cuiListener));
    scope.add(() => doc.documentElement.removeAttribute("vfx-status-text-placed"));
    win.setTimeout(sync, 0);
    win.vfxStatusText = { sync };
    scope.add(() => delete win.vfxStatusText);
  },
};
