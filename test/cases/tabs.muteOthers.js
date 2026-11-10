const a = await openTab(page("a")); const b = await openTab(page("b"));
gBrowser.selectedTab = b;
assert($("#vfx-mute-others"), "menu item");
VivaldiFox.Commands.run("tabs.muteOthers", win);
assert(a.linkedBrowser.audioMuted, "other tab muted");
assert(!b.linkedBrowser.audioMuted, "active tab not muted");
VivaldiFox.Commands.run("tabs.unmuteAll", win);
assert(!a.linkedBrowser.audioMuted, "unmuted again");
return "other tabs muted, active left alone, unmute restores";
