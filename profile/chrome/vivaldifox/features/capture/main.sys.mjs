/* MPL-2.0. C1: capture the page (full or visible) to a file or the clipboard.
 *
 * Uses WindowGlobalParent.drawSnapshot, the same platform primitive behind
 * Firefox Screenshots, plus a tiny content script for page geometry. Area selection is
 * delegated to Firefox's own Screenshots UI.
 */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";
import { contentScript, ask } from "../../core/content.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";

// Canvas limits: stay well inside Gecko's maximum surface size.
const MAX_SIDE = 32000, MAX_AREA = 120e6;

/** Render the selected tab to a PNG/JPEG blob. */
export async function snapshot(win, { full, format = "png" }) {
  const browser = win.gBrowser.selectedBrowser;
  const wg = browser.browsingContext?.currentWindowGlobal;
  if (!wg) throw new Error("Nothing to capture in this tab");
  const m = await ask(browser, "vfx:capture:metrics");
  if (!m) throw new Error("This page cannot be captured");
  const rect = full ? new win.DOMRect(0, 0, m.pageWidth, m.pageHeight) : new win.DOMRect(m.scrollX, m.scrollY, m.viewWidth, m.viewHeight);
  let scale = m.dpr || 1;
  // Scale very long pages down rather than failing.
  scale = Math.min(scale, MAX_SIDE / rect.width, MAX_SIDE / rect.height, Math.sqrt(MAX_AREA / (rect.width * rect.height)));
  const canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const g = canvas.getContext("2d");
  // Draw in horizontal strips (as Firefox Screenshots does): one huge
  // snapshot can exceed the compositor's surface limit on long pages.
  // Only the three long-stable arguments of drawSnapshot are used.
  const STRIP = Math.max(256, Math.floor(4096 / scale));
  for (let y = 0; y < rect.height; y += STRIP) {
    const hgt = Math.min(STRIP, rect.height - y);
    const bitmap = await wg.drawSnapshot(new win.DOMRect(rect.x, rect.y + y, rect.width, hgt), scale, "rgb(255,255,255)");
    g.drawImage(bitmap, 0, Math.round(y * scale));
    bitmap.close();
  }
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const blob = await new Promise(r => canvas.toBlob(r, mime, 0.92));
  return { blob, mime, width: canvas.width, height: canvas.height, title: m.title, url: browser.currentURI.spec };
}

async function targetDir(ctx) {
  const custom = ctx.opt("folder").trim();
  if (custom) {
    await IOUtils.makeDirectory(custom, { ignoreExisting: true, createAncestors: true });
    return custom;
  }
  return Fx.Downloads.getPreferredDownloadsDirectory();
}

function fileName(title, ext) {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
  const safe = (title || "page").replace(/[\\/:*?"<>|\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return `Capture ${stamp} ${safe}.${ext}`;
}

export async function captureToFile(win, ctx, full) {
  const format = ctx.opt("format") === "jpg" ? "jpg" : "png";
  const shot = await snapshot(win, { full, format });
  // createUniqueFile: two captures in the same second must not overwrite each other.
  const path = await IOUtils.createUniqueFile(await targetDir(ctx), fileName(shot.title, format), 0o644);
  await IOUtils.write(path, new Uint8Array(await shot.blob.arrayBuffer()));
  toast(win, `Saved capture: ${path}`);
  return path;
}

export async function captureToClipboard(win, full) {
  const shot = await snapshot(win, { full, format: "png" });
  const img = Cc["@mozilla.org/image/tools;1"].getService(Ci.imgITools).decodeImageFromArrayBuffer(await shot.blob.arrayBuffer(), "image/png");
  const tr = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
  tr.init(null);
  tr.addDataFlavor("application/x-moz-nativeimage");
  tr.setTransferData("application/x-moz-nativeimage", img);
  Services.clipboard.setData(tr, null, Ci.nsIClipboard.kGlobalClipboard);
  toast(win, `Capture copied to clipboard (${shot.width}×${shot.height})`);
  return { width: shot.width, height: shot.height };
}

function selectArea(win) {
  // Hand over to Firefox Screenshots for interactive region selection.
  Services.obs.notifyObservers(win, "menuitem-screenshot", "ToolbarButton");
}

const guard = (win, p) => p.catch(e => {
  console.warn("[vivaldifox:capture]", e);
  toast(win, `Capture failed: ${e.message}`);
});

export default {
  start(scope, ctx) {
    const actions = [
      ["capture.fullFile", "Capture Full Page to File", w => captureToFile(w, ctx, true)],
      ["capture.visibleFile", "Capture Visible Area to File", w => captureToFile(w, ctx, false)],
      ["capture.fullClipboard", "Capture Full Page to Clipboard", w => captureToClipboard(w, true)],
      ["capture.visibleClipboard", "Capture Visible Area to Clipboard", w => captureToClipboard(w, false)],
    ];
    for (const [id, label, fn] of actions) ctx.Commands.register(scope, { id, label, run: w => guard(w, fn(w)) });
    ctx.Commands.register(scope, { id: "capture.area", label: "Capture: select area", run: selectArea });
    menuWidget(ctx, scope, {
      id: "vfx-capture", label: "Capture", tooltip: "Capture page", icon: icon("camera"),
      area: ctx.isRunning("statusbar") ? "vfx-statusbar" : ctx.CustomizableUI.AREA_NAVBAR,
      populate(popup, win) {
        const doc = win.document;
        for (const [, label, fn] of actions) popup.append(h(doc, "menuitem", { label, oncommand: () => guard(win, fn(win)) }));
        popup.append(h(doc, "menuseparator"));
        popup.append(h(doc, "menuitem", { label: "Select Area…", oncommand: () => selectArea(win) }));
        // Optional bridge: only offered while the Notes panel feature is running.
        if (ctx.isRunning("panels.notes")) {
          popup.append(h(doc, "menuseparator"));
          popup.append(h(doc, "menuitem", { label: "Capture Visible Area to Note", oncommand: () => guard(win, captureToNote(win, ctx)) }));
        }
      },
    });
  },
  window(win, scope, ctx) {
    contentScript(scope, win, ctx.id);
    win.vfxCapture = { toFile: full => captureToFile(win, ctx, full), toClipboard: full => captureToClipboard(win, full), toNote: () => captureToNote(win, ctx) };
    scope.add(() => delete win.vfxCapture);
  },
};

/** C2 bridge: save a capture next to the notes and add a note pointing at it. */
async function captureToNote(win, ctx) {
  if (!ctx.isRunning("panels.notes")) throw new Error("The Notes panel feature is not enabled");
  const { Notes } = ChromeUtils.importESModule("chrome://vivaldifox/content/features/panels.notes/notes.sys.mjs");
  const shot = await snapshot(win, { full: false, format: "png" });
  const dir = PathUtils.join(ctx.Store.dir, "captures");
  await IOUtils.makeDirectory(dir, { ignoreExisting: true, createAncestors: true });
  const path = await IOUtils.createUniqueFile(dir, fileName(shot.title, "png"), 0o644);
  await IOUtils.write(path, new Uint8Array(await shot.blob.arrayBuffer()));
  const note = await Notes.add({ title: shot.title || "Capture", text: `Captured from ${shot.url}`, url: shot.url, image: PathUtils.toFileURI(path) });
  toast(win, "Capture added to Notes");
  return note;
}
