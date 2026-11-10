/* MPL-2.0. P5: Reading List panel.
 * Items are ordinary bookmarks in a "Reading List" folder (under Other
 * Bookmarks), so they sync with Firefox Sync and remain usable if the mod is
 * removed. Read/unread state is kept in vivaldifox-data/readingList.json. */
import { h, icon } from "../../core/ui.sys.mjs";
import { Panels } from "../../core/panels.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";
import { Store } from "../../core/store.sys.mjs";

const PANEL = "readingList";
const FOLDER = "Reading List";
const DOC = "readingList";

async function folderGuid(create) {
  const B = Fx.PlacesUtils.bookmarks;
  const tree = await Fx.PlacesUtils.promiseBookmarksTree(B.unfiledGuid);
  const found = (tree?.children || []).find(c => c.type === Fx.PlacesUtils.TYPE_X_MOZ_PLACE_CONTAINER && c.title === FOLDER);
  if (found) return found.guid;
  if (!create) return null;
  return (await B.insert({ parentGuid: B.unfiledGuid, type: B.TYPE_FOLDER, title: FOLDER })).guid;
}

export const ReadingList = {
  async items() {
    const guid = await folderGuid(false);
    if (!guid) return [];
    const state = await Store.load(DOC, { read: {} });
    const tree = await Fx.PlacesUtils.promiseBookmarksTree(guid);
    return (tree?.children || []).filter(c => c.uri).map(c => ({ guid: c.guid, title: c.title || c.uri, url: c.uri, added: c.dateAdded / 1000, read: !!state.read?.[c.guid] })).reverse();
  },
  async add(url, title) {
    if (!/^(https?|file|about):/i.test(url) || url === "about:blank") return null;
    const guid = await folderGuid(true);
    const existing = (await this.items()).find(i => i.url === url);
    if (existing) return existing;
    const bm = await Fx.PlacesUtils.bookmarks.insert({ parentGuid: guid, url, title: title || url });
    Store.save(DOC);
    return { guid: bm.guid, url, title };
  },
  async remove(guid) {
    await Fx.PlacesUtils.bookmarks.remove(guid).catch(() => {});
    const state = await Store.load(DOC, { read: {} });
    delete state.read?.[guid];
    Store.save(DOC);
  },
  async setRead(guid, read) {
    const state = await Store.load(DOC, { read: {} });
    state.read ||= {};
    if (read) state.read[guid] = true;
    else delete state.read[guid];
    Store.save(DOC);
  },
  onChange: fn => Store.onChange(DOC, fn),
};

async function addCurrent(win) {
  const b = win.gBrowser.selectedBrowser;
  const item = await ReadingList.add(b.currentURI.spec, b.contentTitle || win.gBrowser.selectedTab.label);
  toast(win, item ? "Added to Reading List" : "This page cannot be added to the Reading List");
  return item;
}

function build(node, win) {
  const doc = win.document;
  const list = h(doc, "html:div", { class: "vfx-p-list" });
  let unreadOnly = false;
  const filterBtn = h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "Unread", tooltiptext: "Show unread only", oncommand: () => { unreadOnly = !unreadOnly; filterBtn.toggleAttribute("checked", unreadOnly); render(); } });

  const render = async () => {
    let items = [];
    try { items = await ReadingList.items(); } catch (e) { console.error("[vivaldifox:readingList]", e); }
    if (unreadOnly) items = items.filter(i => !i.read);
    list.replaceChildren(...items.map(it => {
      let host = it.url;
      try { host = new URL(it.url).host || it.url; } catch {}
      const btn = (label, tip, fn) => {
        const b = h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label, tooltiptext: tip });
        b.addEventListener("click", e => { e.stopPropagation(); fn(); });
        return b;
      };
      const row = h(doc, "html:div", { class: "vfx-p-row vfx-rl-row", "data-guid": it.guid, "vfx-read": it.read ? "true" : null }, [
        h(doc, "html:img", { class: "vfx-rl-icon", src: `page-icon:${it.url}`, alt: "" }),
        h(doc, "html:div", { class: "vfx-p-main" }, [
          h(doc, "html:span", { class: "vfx-p-title", text: it.title, title: it.url }),
          h(doc, "html:span", { class: "vfx-p-sub", text: host }),
        ]),
        btn(it.read ? "○" : "✓", it.read ? "Mark as unread" : "Mark as read", () => ReadingList.setRead(it.guid, !it.read)),
        btn("✕", "Remove", () => ReadingList.remove(it.guid)),
      ]);
      row.addEventListener("click", e => {
        win.openTrustedLinkIn(it.url, e.ctrlKey || e.metaKey || e.button === 1 ? "tab" : "current");
        ReadingList.setRead(it.guid, true);
      });
      return row;
    }));
    if (!items.length) list.append(h(doc, "html:div", { class: "vfx-p-empty", text: unreadOnly ? "Nothing unread." : "Your reading list is empty." }));
  };

  node.append(
    h(doc, "hbox", { class: "vfx-p-toolbar" }, [
      h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "＋ Add current page", oncommand: () => addCurrent(win) }),
      h(doc, "spacer", { flex: "1" }),
      filterBtn,
    ]),
    list);
  const off = ReadingList.onChange(() => render());
  render();
  node.vfxReadingList = { render };
  return off;
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "panels.readingList", label: "Toggle Reading List panel", run: w => Panels.toggle(w, PANEL) });
    ctx.Commands.register(scope, { id: "readingList.addCurrent", label: "Add page to Reading List", run: addCurrent });
  },
  window(win, scope) {
    Panels.register(scope, win, { id: PANEL, title: "Reading List", icon: icon("reading"), order: 30, build, onShow: node => node.vfxReadingList?.render() });
    win.vfxReadingList = { ReadingList, addCurrent: () => addCurrent(win) };
    scope.add(() => delete win.vfxReadingList);
  },
};
