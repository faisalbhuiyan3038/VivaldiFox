// prefs: {"closeButton": "hidden", "unreadIndicator": true}
const a = await openTab(page("a"));
await sleep(300);
assert(doc.documentElement.getAttribute("vfx-tab-close") === "hidden", "root attr");
const cb = a.querySelector(".tab-close-button");
assert(cb, "close button element still exists in this Firefox");
assert(win.getComputedStyle(cb).display === "none", "close button hidden");
assert(a.hasAttribute("vfx-unread"), "unread attribute present on background tab");
const dot = win.getComputedStyle(a.querySelector(".tab-icon-stack"), "::after");
assert(dot.content !== "none", "unread dot rendered");
gBrowser.selectedTab = a; await sleep(100);
assert(!a.hasAttribute("vfx-unread"), "cleared on select");
return "close buttons hidden; unread dot on background tab";
