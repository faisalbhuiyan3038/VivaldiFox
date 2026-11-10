/* MPL-2.0. T6: Workspaces. Named sets of tabs; only the active workspace's
 * tabs are shown in the tab bar.
 *
 * Safety first: tabs are never closed, moved or re-created. A tab's workspace
 * is a SessionStore custom value on the tab, and switching only calls
 * gBrowser.hideTab()/showTab() (the API the WebExtension tabs.hide uses).
 * If the feature is turned off, or fails, every tab is simply shown again.
 * Workspace names live in <profile>/vivaldifox-data/workspaces.json.
 * Concept as in Vivaldi/Floorp/Zen; code written for this project.
 */
import { h, icon, menuWidget, addToPopup, onPopupShowing, contextTab, promptText } from "../../core/ui.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";
import { Store } from "../../core/store.sys.mjs";

const DOC = "workspaces";
const TAB_KEY = "vivaldifox-workspace";
const WIN_KEY = "vivaldifox-workspace-active";
const DEFAULT = "default";

/** In-memory copy of the workspace list (loaded once in start()). */
let state = { list: [{ id: DEFAULT, name: "Default" }] };
const save = () => Store.save(DOC);

const wsOf = tab => {
  let id = "";
  try { id = Fx.SessionStore.getCustomTabValue(tab, TAB_KEY); } catch {}
  return state.list.some(w => w.id === id) ? id : DEFAULT;
};
const setWs = (tab, id) => {
  try {
    if (id === DEFAULT) Fx.SessionStore.deleteCustomTabValue(tab, TAB_KEY);
    else Fx.SessionStore.setCustomTabValue(tab, TAB_KEY, id);
  } catch (e) { console.error("[vivaldifox:workspaces]", e); }
};

function activeOf(win) {
  let id = win.vfxWorkspaceActive;
  if (!id) {
    try { id = Fx.SessionStore.getCustomWindowValue(win, WIN_KEY); } catch {}
  }
  return state.list.some(w => w.id === id) ? id : DEFAULT;
}

/** Show exactly the tabs of the active workspace (pinned tabs are shared). */
function apply(win) {
  const gB = win.gBrowser, active = activeOf(win);
  win.vfxWorkspaceActive = active;
  // The selected tab can never be hidden, so make sure it belongs here first.
  if (!gB.selectedTab.pinned && wsOf(gB.selectedTab) !== active) {
    const mine = gB.tabs.filter(t => !t.closing && (t.pinned || wsOf(t) === active));
    const last = win.vfxWorkspaceLast?.get(active);
    const target = (last?.isConnected && !last.closing && mine.includes(last) && last) || mine.find(t => !t.pinned) || mine[0];
    if (target) {
      gB.showTab(target);
      gB.selectedTab = target;
    } else {
      // Empty workspace: give it a tab of its own.
      const tab = gB.addTrustedTab(win.BROWSER_NEW_TAB_URL || "about:newtab", { inBackground: false });
      setWs(tab, active);
    }
  }
  for (const tab of gB.tabs) {
    if (tab.closing) continue;
    if (tab.pinned || wsOf(tab) === active) gB.showTab(tab);
    else gB.hideTab(tab, "vivaldifox-workspaces");
  }
  updateButton(win);
}

function updateButton(win) {
  const btn = win.document.getElementById("vfx-workspaces");
  if (!btn) return;
  const ws = state.list.find(w => w.id === activeOf(win));
  btn.setAttribute("label", ws?.name || "Workspace");
  btn.setAttribute("tooltiptext", `Workspace: ${ws?.name || ""}`);
}

function switchTo(win, id) {
  if (!state.list.some(w => w.id === id)) return;
  win.vfxWorkspaceLast ||= new Map();
  win.vfxWorkspaceLast.set(activeOf(win), win.gBrowser.selectedTab);
  win.vfxWorkspaceActive = id;
  try { Fx.SessionStore.setCustomWindowValue(win, WIN_KEY, id); } catch {}
  apply(win);
}

function cycle(win, dir) {
  const i = state.list.findIndex(w => w.id === activeOf(win));
  switchTo(win, state.list[(i + dir + state.list.length) % state.list.length].id);
}

function create(win, name) {
  const ws = { id: "ws" + Date.now().toString(36), name: name || `Workspace ${state.list.length + 1}` };
  state.list.push(ws);
  save();
  if (win) switchTo(win, ws.id);
  return ws;
}

function remove(id) {
  if (id === DEFAULT) return;
  state.list = state.list.filter(w => w.id !== id);
  save();
  // Its tabs fall back to the default workspace (wsOf() maps unknown ids there).
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    if (!win.gBrowser) continue;
    for (const tab of win.gBrowser.tabs) if (!state.list.some(w => w.id === wsOfRaw(tab))) setWs(tab, DEFAULT);
    if (win.vfxWorkspaceActive === id) win.vfxWorkspaceActive = DEFAULT;
    apply(win);
  }
}
const wsOfRaw = tab => { try { return Fx.SessionStore.getCustomTabValue(tab, TAB_KEY) || DEFAULT; } catch { return DEFAULT; } };

function moveTab(win, tab, id) {
  const tabs = tab.multiselected ? win.gBrowser.selectedTabs : [tab];
  for (const t of tabs) setWs(t, id);
  apply(win);
}

export default {
  async start(scope, ctx) {
    const loaded = await Store.load(DOC, state);
    if (!Array.isArray(loaded.list) || !loaded.list.some(w => w.id === DEFAULT)) loaded.list = [{ id: DEFAULT, name: "Default" }, ...(Array.isArray(loaded.list) ? loaded.list : [])];
    state = loaded;
    if (scope.disposed) return;

    ctx.Commands.register(scope, { id: "workspaces.next", label: "Next workspace", run: w => cycle(w, 1) });
    ctx.Commands.register(scope, { id: "workspaces.prev", label: "Previous workspace", run: w => cycle(w, -1) });
    ctx.Commands.register(scope, { id: "workspaces.new", label: "New workspace…", run: w => { const n = promptText(w, "New Workspace", "Workspace name:", ""); if (n !== null) create(w, n.trim()); } });

    menuWidget(ctx, scope, {
      id: "vfx-workspaces", label: "Workspaces", tooltip: "Workspaces", icon: icon("workspaces"),
      area: ctx.CustomizableUI.AREA_TABSTRIP, overflows: false,
      onCreated: (node, win) => { node.classList.add("vfx-labelled"); win.setTimeout(() => updateButton(win), 0); },
      populate(popup, win) {
        const doc = win.document, active = activeOf(win);
        for (const ws of state.list) {
          const n = win.gBrowser.tabs.filter(t => !t.pinned && !t.closing && wsOf(t) === ws.id).length;
          popup.append(h(doc, "menuitem", { type: "radio", label: `${ws.name}  (${n})`, checked: ws.id === active, oncommand: () => switchTo(win, ws.id) }));
        }
        popup.append(h(doc, "menuseparator"));
        popup.append(h(doc, "menuitem", { label: "New Workspace…", oncommand: () => ctx.Commands.run("workspaces.new", win) }));
        popup.append(h(doc, "menuitem", { label: "Rename Current Workspace…", oncommand: () => {
          const ws = state.list.find(w => w.id === active);
          const n = promptText(win, "Rename Workspace", "Workspace name:", ws.name);
          if (n?.trim()) { ws.name = n.trim(); save(); updateButton(win); }
        } }));
        popup.append(h(doc, "menuitem", { label: "Delete Current Workspace (keeps its tabs)", disabled: active === DEFAULT, oncommand: () => remove(active) }));
      },
    });

    // On disable: every tab visible again, nothing else touched.
    scope.add(() => {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (!win.gBrowser) continue;
        for (const tab of win.gBrowser.tabs) { try { win.gBrowser.showTab(tab); } catch {} }
        delete win.vfxWorkspaceActive;
        delete win.vfxWorkspaceLast;
      }
    });
  },
  window(win, scope) {
    const gB = win.gBrowser, strip = gB.tabContainer, doc = win.document;
    // New tabs join the active workspace.
    scope.listen(strip, "TabOpen", e => {
      if (wsOfRaw(e.target) === DEFAULT && activeOf(win) !== DEFAULT) setWs(e.target, activeOf(win));
    });
    // Restored tabs carry their workspace: re-evaluate visibility once known.
    let pending = 0;
    const later = () => { win.clearTimeout(pending); pending = win.setTimeout(() => apply(win), 50); };
    scope.listen(strip, "SSTabRestoring", later);
    scope.listen(strip, "TabUnpinned", later);
    // Something else (e.g. opening a link from another app) selected a tab of
    // another workspace: follow it rather than fight it.
    scope.listen(strip, "TabSelect", e => {
      const tab = e.target;
      if (!tab.pinned && wsOf(tab) !== activeOf(win)) switchTo(win, wsOf(tab));
    });
    scope.add(() => win.clearTimeout(pending));

    const sub = h(doc, "menupopup");
    const menu = addToPopup(scope, win, "tabContextMenu", h(doc, "menu", { id: "vfx-ws-move", label: "Move to Workspace" }, sub), "context_moveTabOptions");
    if (menu) {
      onPopupShowing(scope, win, "tabContextMenu", () => {
        const tab = contextTab(win);
        sub.replaceChildren(...state.list.map(ws => h(doc, "menuitem", { type: "radio", label: ws.name, checked: wsOf(tab) === ws.id, oncommand: () => moveTab(win, tab, ws.id) })));
        menu.disabled = tab.pinned;
      });
    }
    apply(win);
    win.vfxWorkspaces = { list: () => state.list, active: () => activeOf(win), switchTo: id => switchTo(win, id), create: n => create(win, n), remove, moveTab: (t, id) => moveTab(win, t, id), wsOf };
    scope.add(() => delete win.vfxWorkspaces);
  },
};
