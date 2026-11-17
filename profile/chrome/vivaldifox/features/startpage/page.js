/* MPL-2.0. Start Page logic. Runs as a privileged chrome document.
 *
 * Speed Dial tiles are ordinary bookmarks inside a bookmarks folder named
 * "Speed Dial" (created under Bookmarks Menu on first use); its subfolders
 * are the dial groups. Nothing is stored outside Firefox's bookmarks, so the
 * data syncs and survives removal of the mod.
 */
const { VivaldiFox } = ChromeUtils.importESModule("chrome://vivaldifox/content/boot.sys.mjs");
const { Fx } = ChromeUtils.importESModule("chrome://vivaldifox/content/core/fx.sys.mjs");

const ID = "startpage";
const FOLDER = "Speed Dial";
const opt = k => VivaldiFox.opt(ID, k);
const $ = s => document.querySelector(s);

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...[].concat(kids).filter(Boolean));
  return n;
}

const hostOf = url => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; } };
const tint = s => `hsl(${[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)} 55% 50%)`;

function navigate(url, e) {
  const newTab = e && (e.ctrlKey || e.metaKey || e.button === 1);
  const win = window.browsingContext.topChromeWindow;
  win.openTrustedLinkIn(url, newTab ? "tabshifted" : "current");
}

// ───────────────────────────── Speed Dial ─────────────────────────────
async function dialFolder(create) {
  const PU = Fx.PlacesUtils, B = PU.bookmarks;
  for (const root of [B.menuGuid, B.toolbarGuid, B.unfiledGuid]) {
    const tree = await PU.promiseBookmarksTree(root);
    const hit = (tree?.children || []).find(c => c.type === PU.TYPE_X_MOZ_PLACE_CONTAINER && c.title === FOLDER);
    if (hit) return hit;
  }
  if (!create) return null;
  const f = await B.insert({ parentGuid: B.menuGuid, type: B.TYPE_FOLDER, title: FOLDER });
  return PU.promiseBookmarksTree(f.guid);
}

async function topSites(n) {
  try {
    const db = await Fx.PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(
      "SELECT url, title FROM moz_places WHERE hidden = 0 AND last_visit_date NOT NULL AND url LIKE 'http%' ORDER BY frecency DESC LIMIT :n", { n });
    return rows.map(r => ({ uri: r.getResultByName("url"), title: r.getResultByName("title") || hostOf(r.getResultByName("url")) }));
  } catch (e) {
    console.warn("[vivaldifox:startpage] top sites", e);
    return [];
  }
}

function tile(item, onRemove) {
  const thumb = el("div", { class: "thumb", style: `--tint: ${tint(hostOf(item.uri))}` }, el("img", { src: `page-icon:${item.uri}`, alt: "" }));
  const a = el("a", { class: "tile", href: item.uri, title: item.uri, "data-url": item.uri }, [
    thumb,
    el("div", { class: "cap", text: item.title || hostOf(item.uri) }),
    onRemove ? el("button", { class: "x", type: "button", title: "Remove", "aria-label": `Remove ${item.title || item.uri}`, text: "✕", onclick: e => { e.preventDefault(); e.stopPropagation(); onRemove(); } }) : null,
  ]);
  a.addEventListener("click", e => { e.preventDefault(); navigate(item.uri, e); });
  a.addEventListener("auxclick", e => { if (e.button === 1) { e.preventDefault(); navigate(item.uri, e); } });
  if (opt("thumbnails")) loadThumb(item.uri, thumb);
  return a;
}

/** Use Firefox's own page-thumbnail cache; fall back to the favicon tile. */
async function loadThumb(url, thumb) {
  try {
    if (!/^https?:/.test(url)) return;
    const PT = Fx.PageThumbs;
    const show = () => {
      const src = PT.getThumbnailURL(url);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth < 8) return;
        thumb.style.backgroundImage = `url("${src}")`;
        thumb.setAttribute("data-shot", "1");
      };
      img.src = src;
    };
    show();
    // Capture in the background if Firefox has no thumbnail yet.
    await Fx.BackgroundPageThumbs.captureIfMissing(url);
    if (!thumb.hasAttribute("data-shot")) show();
  } catch (e) { /* thumbnails are best-effort */ }
}

async function addTile(parentGuid) {
  const url = { value: "https://" }, title = { value: "" };
  if (!Services.prompt.prompt(window, "Add to Speed Dial", "Address:", url, null, {})) return;
  let spec;
  try { spec = Services.uriFixup.getFixupURIInfo(url.value.trim(), 0).preferredURI.spec; } catch { return; }
  Services.prompt.prompt(window, "Add to Speed Dial", "Title (optional):", title, null, {});
  const guid = parentGuid || (await dialFolder(true)).guid;
  await Fx.PlacesUtils.bookmarks.insert({ parentGuid: guid, url: spec, title: title.value.trim() || hostOf(spec) });
  render();
}

let dialGroup = null;
async function viewDial() {
  const view = $("#view"), groupsBar = $("#groups");
  const folder = await dialFolder(false);
  const kids = folder?.children || [];
  const isFolder = c => c.type === Fx.PlacesUtils.TYPE_X_MOZ_PLACE_CONTAINER;
  const groups = kids.filter(isFolder);
  const rootItems = kids.filter(c => c.uri);

  groupsBar.replaceChildren();
  if (groups.length) {
    const names = [{ guid: null, title: folder.title }, ...groups];
    if (!names.some(g => g.guid === dialGroup)) dialGroup = null;
    for (const g of names) {
      groupsBar.append(el("button", { role: "tab", "aria-selected": String(g.guid === dialGroup), text: g.title || "Group", onclick: () => { dialGroup = g.guid; viewDial(); } }));
    }
  }
  const current = dialGroup ? groups.find(g => g.guid === dialGroup) : null;
  const items = current ? (current.children || []).filter(c => c.uri) : rootItems;
  const parentGuid = current?.guid || folder?.guid || null;

  const grid = el("div", { class: "dial" });
  if (items.length) {
    for (const it of items) grid.append(tile(it, async () => { await Fx.PlacesUtils.bookmarks.remove(it.guid); render(); }));
    grid.append(el("div", { class: "tile add", role: "button", tabindex: "0", title: "Add a site", text: "+", onclick: () => addTile(parentGuid), onkeydown: e => { if (e.key === "Enter") addTile(parentGuid); } }));
    view.replaceChildren(grid);
  } else {
    // Empty dial: show most-visited sites so the page is useful on day one.
    const top = await topSites(opt("columns") * 2);
    for (const it of top) grid.append(tile(it));
    grid.append(el("div", { class: "tile add", role: "button", tabindex: "0", title: "Add a site", text: "+", onclick: () => addTile(parentGuid), onkeydown: e => { if (e.key === "Enter") addTile(parentGuid); } }));
    view.replaceChildren(
      el("div", { class: "hint", text: top.length ? "Most visited sites. Add your own with +, or put bookmarks in a “Speed Dial” bookmarks folder (subfolders become groups)." : "Add sites with +, or put bookmarks in a “Speed Dial” bookmarks folder (subfolders become groups)." }),
      grid);
  }
}

// ───────────────────────────── Bookmarks ─────────────────────────────
let bmPath = [];
async function viewBookmarks() {
  const PU = Fx.PlacesUtils, B = PU.bookmarks;
  $("#groups").replaceChildren();
  const roots = [[B.toolbarGuid, "Bookmarks Toolbar"], [B.menuGuid, "Bookmarks Menu"], [B.unfiledGuid, "Other Bookmarks"]];
  const view = $("#view");
  const crumbs = el("div", { class: "crumbs" }, [el("button", { class: "btn", text: "Bookmarks", onclick: () => { bmPath = []; viewBookmarks(); } })]);
  bmPath.forEach((p, i) => crumbs.append("›", el("button", { class: "btn", text: p.title, onclick: () => { bmPath = bmPath.slice(0, i + 1); viewBookmarks(); } })));
  const list = el("div", { class: "list" });
  let children;
  if (!bmPath.length) children = roots.map(([guid, title]) => ({ guid, title, folder: true }));
  else {
    const tree = await PU.promiseBookmarksTree(bmPath.at(-1).guid);
    children = (tree?.children || []).map(c => ({ guid: c.guid, title: c.title, uri: c.uri, folder: c.type === PU.TYPE_X_MOZ_PLACE_CONTAINER }));
  }
  for (const c of children) {
    if (c.folder) {
      list.append(el("div", { class: "row", tabindex: "0", role: "link", onclick: () => { bmPath.push({ guid: c.guid, title: c.title || "Folder" }); viewBookmarks(); }, onkeydown: e => { if (e.key === "Enter") e.currentTarget.click(); } }, [
        el("img", { src: "chrome://global/skin/icons/folder.svg", alt: "" }), el("span", { class: "t", text: c.title || "Folder" }), el("span", { class: "u" })]));
    } else if (c.uri) {
      list.append(linkRow(c.uri, c.title));
    }
  }
  if (!list.childElementCount) list.append(el("div", { class: "row", text: "This folder is empty." }));
  view.replaceChildren(crumbs, list);
}

function linkRow(url, title, right) {
  const a = el("a", { class: "row", href: url, title: url }, [
    el("img", { src: `page-icon:${url}`, alt: "" }),
    el("span", { class: "t", text: title || hostOf(url) }),
    el("span", { class: "u", text: url }),
    right ? el("span", { class: "d", text: right }) : null,
  ]);
  a.addEventListener("click", e => { e.preventDefault(); navigate(url, e); });
  return a;
}

// ───────────────────────────── History ─────────────────────────────
async function viewHistory() {
  $("#groups").replaceChildren();
  const list = el("div", { class: "list" });
  try {
    const db = await Fx.PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(
      "SELECT url, title, last_visit_date AS t FROM moz_places WHERE hidden = 0 AND last_visit_date NOT NULL ORDER BY last_visit_date DESC LIMIT :n", { n: opt("historyItems") });
    let day = "";
    for (const r of rows) {
      const date = new Date(r.getResultByName("t") / 1000);
      const d = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      if (d !== day) {
        day = d;
        list.append(el("div", { class: "day", text: d }));
      }
      list.append(linkRow(r.getResultByName("url"), r.getResultByName("title"), date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })));
    }
  } catch (e) {
    console.error("[vivaldifox:startpage] history", e);
  }
  if (!list.childElementCount) list.append(el("div", { class: "row", text: "No history yet." }));
  $("#view").replaceChildren(list);
}

// ───────────────── Notes (optional: only while the Notes feature runs) ─────────────────
async function viewNotes() {
  $("#groups").replaceChildren();
  const { Notes, titleOf } = ChromeUtils.importESModule("chrome://vivaldifox/content/features/panels.notes/notes.sys.mjs");
  const list = el("div", { class: "list" });
  for (const n of await Notes.all()) {
    list.append(el("div", { class: "row", style: "align-items: flex-start; cursor: default" }, [
      el("div", { style: "flex: 1; min-width: 0" }, [el("div", { class: "t", style: "font-weight: 600", text: titleOf(n) }), el("div", { class: "u note", text: n.text.slice(0, 400) })]),
      el("span", { class: "d", text: new Date(n.modified).toLocaleDateString() }),
    ]));
  }
  if (!list.childElementCount) list.append(el("div", { class: "row", text: "No notes yet." }));
  $("#view").replaceChildren(list);
}

// ───────────────────────────── Shell ─────────────────────────────
const SECTIONS = [["dial", "Speed Dial", viewDial], ["bookmarks", "Bookmarks", viewBookmarks], ["history", "History", viewHistory]];
let section = "dial";

async function render() {
  const sections = [...SECTIONS];
  if (VivaldiFox.isRunning("panels.notes")) sections.push(["notes", "Notes", viewNotes]);
  if (!sections.some(s => s[0] === section)) section = "dial";
  $("#nav").replaceChildren(...sections.map(([id, label]) =>
    el("button", { role: "tab", "aria-selected": String(id === section), "data-section": id, text: label, onclick: () => { section = id; render(); } })));
  try {
    await sections.find(s => s[0] === section)[2]();
  } catch (e) {
    console.error("[vivaldifox:startpage]", e);
    $("#view").replaceChildren(el("div", { class: "hint", text: `This section failed to load: ${e.message}` }));
  }
  document.documentElement.setAttribute("data-ready", section);
}

function applyOptions() {
  const root = document.documentElement.style;
  root.setProperty("--cols", String(Math.max(2, Math.min(opt("columns"), 10))));
  const bg = String(opt("background") || "").trim();
  const node = $("#bg");
  if (bg) {
    // Accept a URL or a local file path.
    let url = bg;
    if (!/^[a-z-]+:/i.test(bg) || /^[a-z]:[\\/]/i.test(bg)) {
      try { url = PathUtils.toFileURI(bg); } catch {}
    }
    node.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
    node.setAttribute("data-has", "1");
    node.style.setProperty("--dim", String(Math.max(0, Math.min(opt("backgroundDim"), 90)) / 100));
  } else {
    node.style.backgroundImage = "";
    node.removeAttribute("data-has");
  }
}

$("#search").addEventListener("submit", async e => {
  e.preventDefault();
  const q = $("#q").value.trim();
  if (!q) return;
  let url = q;
  try {
    // Services.search was removed in Firefox 160; the module export replaces it.
    const engine = await (Services.search || Fx.SearchService).getDefault();
    url = engine.getSubmission(q).uri.spec;
  } catch {}
  navigate(url, e);
});

// Bookmark changes (from anywhere) refresh the page.
const observer = () => { if (section !== "history") render(); };
try {
  PlacesObservers.addListener(["bookmark-added", "bookmark-removed", "bookmark-moved", "bookmark-title-changed"], observer);
  window.addEventListener("unload", () => PlacesObservers.removeListener(["bookmark-added", "bookmark-removed", "bookmark-moved", "bookmark-title-changed"], observer));
} catch (e) { /* live refresh is optional */ }

applyOptions();
render();
// Automation hook.
window.vfxStartPage = { render, show: s => { section = s; return render(); } };
