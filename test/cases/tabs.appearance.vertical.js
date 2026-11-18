// Arc-style vertical tabs, and no page jump under Firefox's own expand-on-hover
// with the floating page card (the card used to wipe out Firefox's margin).
const P = Services.prefs;
const root = doc.documentElement;
// The auto-hide features replace Firefox's expand-on-hover; this case tests Firefox's own.
for (const f of ["tabs.sidebarAutohide", "look.autohide"]) P.setBoolPref("vivaldifox." + f + ".enabled", false);
let p1, p2;
P.setBoolPref("sidebar.revamp", true);
P.setBoolPref("sidebar.verticalTabs", true);
try {
  await waitFor(() => root.getAttribute("vfx-vtabs") === "start", "vertical styling active");
  const sys = Services.scriptSecurityManager.getSystemPrincipal();
  p1 = gBrowser.addTab("about:robots", { triggeringPrincipal: sys });
  p2 = gBrowser.addTab("about:mozilla", { triggeringPrincipal: sys });
  gBrowser.pinTab(p1); gBrowser.pinTab(p2);
  await sleep(500);
  const bg = win.getComputedStyle(gBrowser.selectedTab.querySelector(".tab-background"));
  assert(bg.boxShadow !== "none", "selected tab is a raised card: " + bg.boxShadow);
  assert(Math.abs(rect(p1).top - rect(p2).top) < 1, "pinned tabs sit side by side in a grid");

  // Firefox's own expand-on-hover: the page must not move when it expands.
  P.setStringPref("sidebar.visibility", "expand-on-hover");
  await waitFor(() => root.hasAttribute("sidebar-expand-on-hover"), "expand-on-hover on");
  const c = $("#sidebar-container"), page = $("#tabbrowser-tabbox");
  mouseAt(rect(page).left + 400, rect(page).top + 300);
  await waitFor(() => !c.hasAttribute("sidebar-launcher-expanded"), "collapsed", 3000);
  await sleep(500);
  const x0 = rect(page).left;
  mouseAt(rect(c).left + 10, rect(c).top + 200);
  await waitFor(() => c.hasAttribute("sidebar-launcher-expanded"), "expanded on hover", 3000);
  await sleep(500);
  const x1 = rect(page).left;
  assert(Math.abs(x1 - x0) < 1, `page stayed put while Firefox expanded the sidebar (${x0} -> ${x1})`);
  mouseAt(rect(page).left + 600, rect(page).top + 300);
  await sleep(300);
  return `raised selected tab; pinned grid; page x ${x0} stable under Firefox expand-on-hover`;
} finally {
  // The runner's cleanup leaves pinned tabs alone.
  for (const t of [p1, p2]) if (t && !t.closing) gBrowser.removeTab(t);
  P.clearUserPref("sidebar.visibility");
  P.clearUserPref("sidebar.verticalTabs");
  P.clearUserPref("sidebar.revamp");
}
