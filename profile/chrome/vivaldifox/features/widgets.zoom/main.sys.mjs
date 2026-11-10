/* MPL-2.0. S3: page zoom slider widget (any toolbar; status bar by default when it is on). */
import { h } from "../../core/ui.sys.mjs";

const ID = "vfx-zoom";

function current(win) {
  try { return Math.round(win.ZoomManager.getZoomForBrowser(win.gBrowser.selectedBrowser) * 100); } catch { return 100; }
}

function setZoom(win, pct) {
  const z = Math.max(30, Math.min(500, pct)) / 100;
  // FullZoom.setZoom also records the site-specific zoom, like the built-in controls.
  if (win.FullZoom?.setZoom) win.FullZoom.setZoom(z, win.gBrowser.selectedBrowser);
  else win.ZoomManager.setZoomForBrowser(win.gBrowser.selectedBrowser, z);
}

export default {
  start(scope, ctx) {
    ctx.widget(scope, {
      id: ID, type: "custom", label: "Zoom Slider", tooltip: "Page zoom",
      area: ctx.isRunning("statusbar") ? "vfx-statusbar" : ctx.CustomizableUI.AREA_NAVBAR,
      onBuild(doc, win) {
        const range = h(doc, "html:input", { type: "range", min: "30", max: "300", step: "5", class: "vfx-zoom-range", "aria-label": "Page zoom" });
        const label = h(doc, "label", { class: "vfx-zoom-label", value: "100%", tooltiptext: "Click to reset zoom" });
        range.addEventListener("input", () => {
          setZoom(win, Number(range.value));
          label.setAttribute("value", range.value + "%");
        });
        range.addEventListener("dblclick", () => win.FullZoom.reset());
        label.addEventListener("click", () => win.FullZoom.reset());
        return h(doc, "toolbaritem", { removable: "true", title: "Zoom Slider", align: "center" }, [range, label]);
      },
    });
  },
  window(win, scope) {
    const doc = win.document;
    const sync = () => {
      const node = doc.getElementById(ID);
      if (!node) return;
      const pct = current(win);
      const range = node.querySelector(".vfx-zoom-range");
      if (range && doc.activeElement !== range) range.value = String(pct);
      node.querySelector(".vfx-zoom-label")?.setAttribute("value", pct + "%");
    };
    scope.listen(win, "FullZoomChange", sync);
    scope.listen(win, "TextZoomChange", sync);
    scope.listen(win.gBrowser.tabContainer, "TabSelect", sync);
    scope.listen(win, "aftercustomization", sync);
    win.setTimeout(sync, 0);
    win.vfxZoom = { set: p => setZoom(win, p), get: () => current(win), sync };
    scope.add(() => delete win.vfxZoom);
  },
};
