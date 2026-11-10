// prefs: {"position": "left"}
assert(Services.prefs.getBoolPref("sidebar.verticalTabs") === true && !Services.prefs.prefHasUserValue("sidebar.verticalTabs"), "native vertical tabs via default branch");
await waitFor(() => gBrowser.tabContainer.verticalMode || gBrowser.tabContainer.hasAttribute("orient") && gBrowser.tabContainer.getAttribute("orient") === "vertical", "Firefox switched to vertical tabs live");
const r = gBrowser.selectedTab.getBoundingClientRect();
assert(r.left < win.innerWidth / 3, "tabs on the left side: " + r.left);
Services.prefs.setBoolPref("vivaldifox.tabs.position.enabled", false);
await waitFor(() => !gBrowser.tabContainer.verticalMode, "back to horizontal tabs on disable");
return "native vertical tabs engaged on the left and reverted on disable";
