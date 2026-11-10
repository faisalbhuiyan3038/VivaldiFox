/* MPL-2.0. P3: Downloads panel. Built on the public Downloads.sys.mjs list
 * API (stable for a decade) instead of embedding Firefox's internal
 * downloads view, so it keeps working when that view is restyled. */
import { h, icon } from "../../core/ui.sys.mjs";
import { Panels } from "../../core/panels.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";

const PANEL = "downloads";

function fmtSize(n) {
  if (!(n > 0)) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

function statusOf(d) {
  if (d.succeeded) return fmtSize(d.target?.size || d.totalBytes) || "Completed";
  if (d.error) return "Failed" + (d.error.message ? `: ${d.error.message}` : "");
  if (d.canceled) return d.hasPartialData ? "Paused" : "Cancelled";
  if (d.hasProgress) return `${d.progress}% of ${fmtSize(d.totalBytes)}`;
  return fmtSize(d.currentBytes) || "Starting…";
}

function build(node, win) {
  const doc = win.document;
  const list = h(doc, "html:div", { class: "vfx-p-list" });
  /** download -> row element */
  const rows = new Map();
  let dlList = null, disposed = false;

  const fill = (row, d) => {
    const name = d.target?.path ? PathUtils.filename(d.target.path) : d.source?.url || "download";
    let host = "";
    try { host = new URL(d.source.url).host; } catch {}
    const running = !d.stopped;
    const btn = (label, tip, fn) => {
      const b = h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label, tooltiptext: tip });
      b.addEventListener("click", e => { e.stopPropagation(); Promise.resolve().then(fn).catch(err => console.warn("[vivaldifox:downloads]", err)); });
      return b;
    };
    row.replaceChildren(
      h(doc, "html:div", { class: "vfx-p-main" }, [
        h(doc, "html:span", { class: "vfx-p-title", text: name, title: d.target?.path || "" }),
        h(doc, "html:span", { class: "vfx-p-sub", text: [statusOf(d), host].filter(Boolean).join(" — ") }),
        running && d.hasProgress ? h(doc, "html:progress", { class: "vfx-dl-progress", max: "100", value: String(d.progress) }) : null,
      ]),
      running ? btn("⏸", "Pause / cancel", () => d.cancel()) : null,
      !running && !d.succeeded ? btn("⟳", "Retry", () => d.start()) : null,
      d.succeeded ? btn("📂", "Show in folder", () => d.showContainingDirectory()) : null,
      btn("✕", "Remove from list", async () => { await dlList.remove(d); await d.finalize(true); }),
    );
    row.toggleAttribute("vfx-dl-missing", d.succeeded && d.target?.exists === false);
  };

  const empty = h(doc, "html:div", { class: "vfx-p-empty", text: "No downloads." });
  const syncEmpty = () => (rows.size ? empty.remove() : list.append(empty));

  const view = {
    onDownloadAdded(d) {
      const row = h(doc, "html:div", { class: "vfx-p-row vfx-dl-row" });
      row.addEventListener("dblclick", () => { if (d.succeeded) d.launch().catch(() => {}); });
      fill(row, d);
      rows.set(d, row);
      list.prepend(row);
      syncEmpty();
    },
    onDownloadChanged(d) {
      const row = rows.get(d);
      if (row) fill(row, d);
    },
    onDownloadRemoved(d) {
      rows.get(d)?.remove();
      rows.delete(d);
      syncEmpty();
    },
  };

  node.append(
    h(doc, "hbox", { class: "vfx-p-toolbar" }, [
      h(doc, "spacer", { flex: "1" }),
      h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "Clear finished", tooltiptext: "Remove finished downloads from the list", oncommand: () => dlList?.removeFinished() }),
      h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "Open folder", tooltiptext: "Open the downloads folder", oncommand: async () => {
        const dir = await Fx.Downloads.getPreferredDownloadsDirectory();
        Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile).initWithPath(dir);
        const f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        f.initWithPath(dir);
        f.reveal();
      } }),
    ]),
    list);
  syncEmpty();

  (async () => {
    // Private windows only see their own private downloads plus public ones.
    const D = Fx.Downloads;
    dlList = await D.getList(Fx.PrivateBrowsingUtils.isWindowPrivate(win) ? D.ALL : D.PUBLIC);
    if (disposed) return;
    await dlList.addView(view);
  })().catch(e => console.error("[vivaldifox:downloads]", e));

  node.vfxDownloads = { rows };
  return () => {
    disposed = true;
    dlList?.removeView(view).catch(() => {});
  };
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "panels.downloads", label: "Toggle Downloads panel", run: w => Panels.toggle(w, PANEL) });
  },
  window(win, scope) {
    Panels.register(scope, win, { id: PANEL, title: "Downloads", icon: icon("downloads"), order: 20, build });
  },
};
