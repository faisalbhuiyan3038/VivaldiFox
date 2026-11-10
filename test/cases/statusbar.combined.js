// Independent features that share the bottom edge must stack predictably
// whatever order they were enabled in: page, address bar, tab bar, stack row, status bar.
for (const f of ["tabs.twoLevel", "nav.bottom", "tabs.position"]) Services.prefs.setBoolPref("vivaldifox." + f + ".enabled", true);
await sleep(800);
const t1 = await openTab(web("<title>c1</title>1")), t2 = await openTab(web("<title>c2</title>2"));
gBrowser.addTabGroup([t1, t2], { label: "S" }); gBrowser.selectedTab = t1;
await waitFor(() => !$("#vfx-stack-row").hidden, "stack row visible");
await sleep(300);
const y = id => $(id).getBoundingClientRect();
const order = ["#browser", "#nav-bar", "#TabsToolbar", "#vfx-stack-row", "#vfx-statusbar"];
for (let i = 1; i < order.length; i++) assert(y(order[i]).top >= y(order[i - 1]).bottom - 1, order[i - 1] + " above " + order[i] + ": " + y(order[i - 1]).bottom + " / " + y(order[i]).top);
assert(Math.abs(y("#vfx-statusbar").bottom - win.innerHeight) < 3, "status bar at the very bottom");
assert(y("#browser").height > win.innerHeight * 0.55, "page keeps most of the window: " + y("#browser").height);
for (const f of ["tabs.twoLevel", "nav.bottom", "tabs.position"]) Services.prefs.setBoolPref("vivaldifox." + f + ".enabled", false);
await sleep(600);
assert($("#TabsToolbar").parentNode.id === "navigator-toolbox" && $("#nav-bar").parentNode.id === "navigator-toolbox", "bars back in the toolbox");
const ids = [...$("#navigator-toolbox").children].map(c => c.id).filter(Boolean);
assert(ids.indexOf("toolbar-menubar") < ids.indexOf("TabsToolbar") && ids.indexOf("TabsToolbar") < ids.indexOf("nav-bar") && ids.indexOf("nav-bar") < ids.indexOf("PersonalToolbar"), "original toolbar order restored: " + ids);
return "page > address bar > tab bar > stack row > status bar, regardless of enable order";
