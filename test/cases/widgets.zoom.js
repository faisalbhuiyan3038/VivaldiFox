const node = await waitFor(() => $("#vfx-zoom"), "widget");
assert(node.closest(st("statusbar").running ? "#vfx-statusbar, #nav-bar" : "#nav-bar"), "in the status bar when it is on, otherwise the nav bar");
const t = await openTab(page("<title>zoom</title>x")); gBrowser.selectedTab = t;
const range = node.querySelector("input");
range.value = "150"; range.dispatchEvent(new win.Event("input", { bubbles: true }));
await waitFor(() => Math.round(win.ZoomManager.getZoomForBrowser(t.linkedBrowser) * 100) === 150, "zoom applied");
win.FullZoom.reset();
await waitFor(() => node.querySelector("label").getAttribute("value") === "100%", "label follows external zoom change");
return "slider sets zoom to 150%; label follows reset to 100%";
