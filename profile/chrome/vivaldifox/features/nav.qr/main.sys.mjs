/* MPL-2.0. A3: QR code for the current page.
 * QR encoding by qrcode-generator (c) Kazuhiko Arase, MIT (vendor/qrcode.js). */
import { h, icon } from "../../core/ui.sys.mjs";

let lib = null;
function qrLib() {
  if (!lib) {
    const target = {};
    Services.scriptloader.loadSubScript("chrome://vivaldifox/content/vendor/qrcode.js", target);
    lib = target.qrcode;
  }
  return lib;
}

/** Returns a boolean matrix for `text`, or null if it does not fit in a QR code. */
export function encode(text) {
  try {
    const qr = qrLib()(0, "M");
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  } catch (e) {
    return null;
  }
}

function draw(canvas, matrix, px) {
  const n = matrix.length, quiet = 4, size = (n + quiet * 2) * px;
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  // Always black on white: QR readers need the contrast regardless of theme.
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (matrix[r][c]) g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
}

function show(win, anchor) {
  const doc = win.document;
  doc.getElementById("vfx-qr-panel")?.remove();
  const url = win.gBrowser.selectedBrowser.currentURI.spec;
  const canvas = h(doc, "html:canvas", { id: "vfx-qr-canvas" });
  const matrix = encode(url);
  const panel = h(doc, "panel", { id: "vfx-qr-panel", type: "arrow", orient: "vertical", class: "vfx-popup" }, [
    h(doc, "vbox", { align: "center", style: "padding: 12px; gap: 8px; max-width: 320px;" }, [
      matrix ? canvas : h(doc, "description", { text: "This address is too long for a QR code." }),
      h(doc, "description", { text: url.length > 90 ? url.slice(0, 90) + "…" : url, style: "word-break: break-all; text-align: center; opacity: .75; font-size: .85em;" }),
    ]),
  ]);
  if (matrix) draw(canvas, matrix, Math.max(3, Math.floor(260 / (matrix.length + 8))));
  panel.addEventListener("popuphidden", () => panel.remove());
  doc.getElementById("mainPopupSet").append(panel);
  panel.openPopup(anchor?.isConnected ? anchor : doc.getElementById("urlbar"), "bottomright topright", 0, 0, false, false);
  return panel;
}

export default {
  start(scope, ctx) {
    ctx.widget(scope, { id: "vfx-qr", label: "QR Code", tooltip: "Show a QR code for this page", icon: icon("qr"), onCommand: (e, w) => show(w, e.target.closest("toolbarbutton")) });
    ctx.Commands.register(scope, { id: "nav.qr", label: "Show QR code for this page", run: w => show(w, w.document.getElementById("vfx-qr")) });
    scope.add(() => {
      for (const w of Services.wm.getEnumerator("navigator:browser")) w.document.getElementById("vfx-qr-panel")?.remove();
    });
  },
};
