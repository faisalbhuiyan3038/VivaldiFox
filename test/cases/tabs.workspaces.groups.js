// Tab groups stay in their workspace.
const W = win.vfxWorkspaces, sys = Services.scriptSecurityManager.getSystemPrincipal();
if (typeof gBrowser.addTabGroup !== "function") return "skipped: no native tab groups in this Firefox";
const a1 = gBrowser.addTab("about:robots", { triggeringPrincipal: sys }), a2 = gBrowser.addTab("about:mozilla", { triggeringPrincipal: sys });
await sleep(200);
const g = gBrowser.addTabGroup([a1, a2], { label: "GroupA" });
await sleep(200);
const second = W.create("Second");
await waitFor(() => W.active() === second.id && g.hasAttribute("vfx-ws-hidden"), "group hidden in another workspace");
assert(win.getComputedStyle(g).display === "none", "group label not drawn");
W.switchTo("default");
await waitFor(() => !g.hasAttribute("vfx-ws-hidden"), "group shown in its own workspace");
W.moveGroup(g, second.id);
await waitFor(() => [a1, a2].every(t => W.wsOf(t) === second.id) && g.hasAttribute("vfx-ws-hidden"), "Move Group moves every tab");
// A tab joining the group adopts the group's workspace.
const b = gBrowser.addTab("about:license", { triggeringPrincipal: sys });
await sleep(200);
g.addTabs([b]);
await waitFor(() => W.wsOf(b) === second.id, "joined tab adopts the group's workspace");
// A tab moved to another workspace leaves its group.
W.switchTo(second.id);
await sleep(200);
W.moveTab(a1, "default");
await waitFor(() => !a1.group && W.wsOf(a1) === "default", "moved tab left the group");
W.switchTo("default");
W.remove(second.id);
return "groups hidden outside their workspace; group move; join adopts; leaving ungroups";
