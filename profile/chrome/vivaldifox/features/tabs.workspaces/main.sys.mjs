/* MPL-2.0. T6: Workspaces. Named sets of tabs; only the active workspace's
 * tabs are shown in the tab bar.
 *
 * Safety first: tabs are never closed, moved or re-created. A tab's workspace
 * is a SessionStore custom value on the tab, and switching only calls
 * gBrowser.hideTab()/showTab() (the API the WebExtension tabs.hide uses).
 * If the feature is turned off, or fails, every tab is simply shown again.
 * Workspace names live in <profile>/vivaldifox-data/workspaces.json.
 *
 * Tab groups belong to the workspace of their tabs: a group whose tabs are all
 * in another workspace is hidden, a tab joining a group adopts the group's
 * workspace, and a tab moved to another workspace leaves its group.
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

/** Native tab groups (Firefox 134+); an empty list where they do not exist. */
function groupsOf(win) {
  try {
    const list = win.gBrowser.tabGroups;
    if (list) return [...list];
  } catch {}
  return [...win.gBrowser.tabContainer.querySelectorAll("tab-group")];
}
const groupTabs = g => (g.tabs ? [...g.tabs] : [...g.querySelectorAll(".tabbrowser-tab")]);

/** Majority workspace of a group's tabs, ignoring `except`. Null if none. */
function groupWs(group, except) {
  const counts = new Map();
  for (const t of groupTabs(group)) {
    if (t === except || t.closing) continue;
    const id = wsOf(t);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  let best = null, n = 0;
  for (const [id, c] of counts) if (c > n) { best = id; n = c; }
  return best;
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
  // Firefox keeps showing a group's label even when every tab in it is
  // hidden, which made groups appear to follow you into every workspace.
  for (const g of groupsOf(win)) {
    const tabs = groupTabs(g).filter(t => !t.closing);
    g.toggleAttribute("vfx-ws-hidden", tabs.length > 0 && !tabs.some(t => wsOf(t) === active));
  }
  updateButton(win);
}

function updateButton(win) {
  const btn = win.document.getElementById("vfx-workspaces");
  if (!btn) return;
  const ws = state.list.find(w => w.id === activeOf(win));
  btn.setAttribute("label", ws?.name || "Workspace");
  btn.setAttribute("tooltiptext", `Workspace: ${ws?.name || ""}\nScroll to switch workspaces`);
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
  const gB = win.gBrowser;
  const tabs = tab.multiselected ? gB.selectedTabs : [tab];
  for (const t of tabs) {
    // A group lives in one workspace (like a Vivaldi stack): a tab moved
    // elsewhere leaves its group, unless the whole group is moving.
    const g = t.group;
    if (g && !groupTabs(g).every(m => tabs.includes(m))) {
      try { gB.ungroupTab?.(t); } catch (e) { console.error("[vivaldifox:workspaces]", e); }
    }
    setWs(t, id);
  }
  apply(win);
}

function moveGroup(win, group, id) {
  for (const t of groupTabs(group)) setWs(t, id);
  apply(win);
}

/**
 * Wheel-to-switch handler. Deltas are accumulated so that a touchpad's many
 * tiny events count as one step, and a short cooldown stops momentum
 * scrolling from flying through several workspaces.
 */
function wheelSwitcher(win, { horizontal, threshold, cooldown, enabled }) {
  let acc = 0, until = 0, resetTimer = 0;
  const scale = e => (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
  return e => {
    if (!enabled()) return;
    let d;
    if (horizontal) {
      // Only clearly horizontal gestures; vertical scrolling stays with the tab list.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      d = e.deltaX;
    } else {
      d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    }
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const now = win.performance.now();
    if (now < until) return;
    acc += d * scale(e);
    win.clearTimeout(resetTimer);
    resetTimer = win.setTimeout(() => { acc = 0; }, 300);
    if (Math.abs(acc) >= threshold) {
      cycle(win, acc > 0 ? 1 : -1);
      acc = 0;
      until = now + cooldown;
    }
  };
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
      onCreated: (node, win) => {
        node.classList.add("vfx-labelled");
        win.setTimeout(() => updateButton(win), 0);
        // Scroll over the button to switch workspaces, as in Vivaldi.
        node.addEventListener("wheel", wheelSwitcher(win, { horizontal: false, threshold: 40, cooldown: 220, enabled: () => ctx.opt("wheelSwitch") }), { passive: false });
      },
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

    // On disable: every tab and group visible again, nothing else touched.
    scope.add(() => {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (!win.gBrowser) continue;
        for (const tab of win.gBrowser.tabs) { try { win.gBrowser.showTab(tab); } catch {} }
        for (const g of groupsOf(win)) g.removeAttribute("vfx-ws-hidden");
        delete win.vfxWorkspaceActive;
        delete win.vfxWorkspaceLast;
      }
    });
  },
  window(win, scope, ctx) {
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
    // Group changes can change which group labels belong in this workspace.
    for (const type of ["TabGroupCreate", "TabGroupRemoved", "TabUngrouped", "TabGroupExpand", "TabGroupCollapse"]) scope.listen(strip, type, later);
    // A tab joining a group adopts the group's workspace, so a group never
    // ends up spread over several workspaces.
    scope.listen(strip, "TabGrouped", e => {
      // Firefox dispatches it on the group, with the tab as the detail.
      const tab = e.detail?.localName === "tab" ? e.detail : e.target?.localName === "tab" ? e.target : null;
      const group = tab?.group;
      if (group) {
        const ws = groupWs(group, tab);
        if (ws && ws !== wsOf(tab)) {
          setWs(tab, ws);
          if (tab.selected) switchTo(win, ws);
        }
      }
      later();
    });
    // Something else (e.g. opening a link from another app) selected a tab of
    // another workspace: follow it rather than fight it.
    scope.listen(strip, "TabSelect", e => {
      const tab = e.target;
      if (!tab.pinned && wsOf(tab) !== activeOf(win)) switchTo(win, wsOf(tab));
    });
    // Touchpad swipe (horizontal scroll) over vertical tabs switches
    // workspaces, like swiping between Spaces in Arc. Horizontal tab strips
    // need horizontal scrolling for themselves, so they are left alone.
    const swipe = wheelSwitcher(win, { horizontal: true, threshold: 120, cooldown: 450, enabled: () => ctx.opt("swipeSwitch") });
    scope.listen(strip, "wheel", e => { if (strip.getAttribute("orient") === "vertical") swipe(e); }, { passive: false });
    scope.add(() => win.clearTimeout(pending));

    const sub = h(doc, "menupopup");
    const menu = addToPopup(scope, win, "tabContextMenu", h(doc, "menu", { id: "vfx-ws-move", label: "Move to Workspace" }, sub), "context_moveTabOptions");
    const gsub = h(doc, "menupopup");
    const gmenu = addToPopup(scope, win, "tabContextMenu", h(doc, "menu", { id: "vfx-ws-move-group", label: "Move Group to Workspace" }, gsub), "context_moveTabOptions");
    if (menu) {
      onPopupShowing(scope, win, "tabContextMenu", () => {
        const tab = contextTab(win);
        sub.replaceChildren(...state.list.map(ws => h(doc, "menuitem", { type: "radio", label: ws.name, checked: wsOf(tab) === ws.id, oncommand: () => moveTab(win, tab, ws.id) })));
        menu.disabled = tab.pinned;
        if (gmenu) {
          const group = tab.group;
          gmenu.hidden = !group;
          if (group) {
            const cur = groupWs(group);
            gsub.replaceChildren(...state.list.map(ws => h(doc, "menuitem", { type: "radio", label: ws.name, checked: cur === ws.id, oncommand: () => moveGroup(win, group, ws.id) })));
          }
        }
      });
    }
    apply(win);
    win.vfxWorkspaces = { list: () => state.list, active: () => activeOf(win), switchTo: id => switchTo(win, id), cycle: d => cycle(win, d), create: n => create(win, n), remove, moveTab: (t, id) => moveTab(win, t, id), moveGroup: (g, id) => moveGroup(win, g, id), wsOf };
    scope.add(() => delete win.vfxWorkspaces);
  },
};
