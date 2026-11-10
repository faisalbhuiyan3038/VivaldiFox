/* MPL-2.0. T15: named sessions. Save the window's tabs under a name and
 * reopen them later. Stored in <profile>/vivaldifox-data/sessions.json.
 * Sessions keep each tab's address, title and pinned state (not its
 * back/forward history or form data: Firefox's own session restore does that). */
import { h, icon, menuWidget, promptText } from "../../core/ui.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { Store } from "../../core/store.sys.mjs";

const DOC = "sessions";
const SAVABLE = /^(https?|file|about|moz-extension|view-source):/i;

async function data() {
  const d = await Store.load(DOC, { list: [] });
  if (!Array.isArray(d.list)) d.list = [];
  return d;
}

export const Sessions = {
  async list() { return (await data()).list; },
  async save(win, name) {
    const tabs = [];
    for (const tab of win.gBrowser.tabs) {
      if (tab.closing || tab.hidden) continue;
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (!url || url === "about:blank" || !SAVABLE.test(url)) continue;
      tabs.push({ url, title: tab.label, pinned: !!tab.pinned });
    }
    if (!tabs.length) return null;
    const d = await data();
    const s = { id: Date.now().toString(36), name: name || new Date().toLocaleString(), created: Date.now(), tabs };
    d.list.unshift(s);
    await Store.save(DOC, { immediate: true });
    return s;
  },
  async remove(id) {
    const d = await data();
    d.list = d.list.filter(s => s.id !== id);
    (await Store.load(DOC)).list = d.list;
    Store.save(DOC);
  },
  /** where: "window" (new window) | "here" (append to this window) */
  open(win, session, where = "window") {
    const urls = session.tabs.map(t => t.url);
    if (!urls.length) return;
    if (where === "here") {
      const opened = session.tabs.map(t => {
        const tab = win.gBrowser.addTrustedTab(t.url, { inBackground: true });
        if (t.pinned) win.gBrowser.pinTab(tab);
        return tab;
      });
      return opened;
    }
    // "url1|url2|..." as the window argument opens one tab per address
    // (the mechanism Firefox uses for multi-page home pages).
    const arg = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
    arg.data = urls.join("|");
    return Services.ww.openWindow(null, win.location.href, "_blank", "chrome,all,dialog=no", arg);
  },
};

async function saveCurrent(win) {
  const name = promptText(win, "Save Session", "Name for this session:", new Date().toLocaleString());
  if (name === null) return;
  const s = await Sessions.save(win, name.trim());
  toast(win, s ? `Saved session “${s.name}” (${s.tabs.length} tabs)` : "No saveable tabs in this window");
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "sessions.save", label: "Save session…", run: saveCurrent });
    // The menu is built synchronously, so keep a current copy of the list.
    let cached = [];
    const refresh = () => Sessions.list().then(l => { cached = [...l]; }).catch(() => {});
    refresh();
    scope.add(Store.onChange(DOC, refresh));
    menuWidget(ctx, scope, {
      id: "vfx-sessions", label: "Sessions", tooltip: "Saved sessions", icon: icon("sessions"),
      populate(popup, win) {
        const doc = win.document;
        popup.append(h(doc, "menuitem", { label: "Save Open Tabs as Session…", oncommand: () => saveCurrent(win) }));
        if (cached.length) popup.append(h(doc, "menuseparator"));
        for (const s of cached.slice(0, 30)) {
          popup.append(h(doc, "menu", { label: `${s.name} (${s.tabs.length})` }, h(doc, "menupopup", {}, [
            h(doc, "menuitem", { label: "Open in New Window", oncommand: () => Sessions.open(win, s, "window") }),
            h(doc, "menuitem", { label: "Open in This Window", oncommand: () => Sessions.open(win, s, "here") }),
            h(doc, "menuseparator"),
            h(doc, "menuitem", { label: "Delete Session", oncommand: () => Sessions.remove(s.id) }),
          ])));
        }
      },
    });
  },
  window(win, scope) {
    win.vfxSessions = { Sessions };
    scope.add(() => delete win.vfxSessions);
  },
};
