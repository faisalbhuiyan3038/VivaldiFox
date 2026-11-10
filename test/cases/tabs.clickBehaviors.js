// prefs: {"activeToPrevious": true}
assert(Services.prefs.getBoolPref("browser.tabs.closeTabByDblclick"), "dblclick pref");
assert(Services.prefs.getBoolPref("toolkit.tabbox.switchByScrolling"), "wheel pref");
const a = await openTab(page("<title>A</title>a")); const b = await openTab(page("<title>B</title>b"));
gBrowser.selectedTab = a; await sleep(100); gBrowser.selectedTab = b; await sleep(100);
const r = b.getBoundingClientRect();
const o = { bubbles: true, button: 0, screenX: 10, screenY: 10, clientX: r.x + 30, clientY: r.y + 10, view: win, detail: 1 };
b.dispatchEvent(new win.MouseEvent("mousedown", o)); b.dispatchEvent(new win.MouseEvent("click", o));
await waitFor(() => gBrowser.selectedTab === a, "switched to previous tab");
return "native prefs applied; click on active tab returned to previous tab";
