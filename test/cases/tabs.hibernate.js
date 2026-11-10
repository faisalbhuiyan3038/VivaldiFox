const t1 = await openTab(page("<title>bg1</title>one"));
const t2 = await openTab(page("<title>bg2</title>two"));
gBrowser.selectedTab = t2;
assert($("#vfx-hibernate-bg"), "context menu item present");
assert(t1.linkedPanel, "t1 loaded before");
VivaldiFox.Commands.run("tabs.hibernateBackground", win);
await waitFor(() => !t1.linkedPanel || t1.hasAttribute("pending"), "t1 discarded");
assert(t2.linkedPanel, "selected tab kept");
return "background tab unloaded, active tab kept";
