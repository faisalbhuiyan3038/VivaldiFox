// prefs: {"radius": 12}
const bg = gBrowser.selectedTab.querySelector(".tab-background");
assert(bg, ".tab-background exists");
assert(win.getComputedStyle(bg).borderTopLeftRadius === "12px", "tab radius: " + win.getComputedStyle(bg).borderTopLeftRadius);
assert(win.getComputedStyle($("#urlbar .urlbar-background")).borderTopLeftRadius === "12px", "address field radius");
return "tabs and address field use the configured 12px radius";
