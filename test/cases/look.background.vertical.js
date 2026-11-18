// prefs: {"image": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='10' height='10' fill='%23845ef7'/%3E%3C/svg%3E"}
// The window's own body layer must not cover the image; the selected tab is
// translucent (Firefox 160 variable name); an auto-hidden sidebar is opaque.
const body = doc.body;
if (body) assert(win.getComputedStyle(body).backgroundColor === "rgba(0, 0, 0, 0)", "window body transparent: " + win.getComputedStyle(body).backgroundColor);
const tabsBar = win.getComputedStyle($("#TabsToolbar"));
assert(/color-mix|transparent|rgba|\/ /.test(tabsBar.getPropertyValue("--tab-background-color-selected") + tabsBar.getPropertyValue("--tab-selected-bgcolor")), "selected tab colour made translucent");
const P = Services.prefs;
P.setBoolPref("sidebar.revamp", true);
P.setBoolPref("sidebar.verticalTabs", true);
P.setBoolPref("vivaldifox.tabs.sidebarAutohide.enabled", true);
try {
  await waitFor(() => doc.documentElement.getAttribute("vfx-sb-mode") === "hidden", "sidebar auto-hidden");
  const main = $("#sidebar-container > sidebar-main");
  const cs = win.getComputedStyle(main);
  assert(!/rgba\(.*, 0\)$/.test(cs.backgroundColor) && cs.backgroundImage.includes("url("), "overlay sidebar is opaque and shows the image: " + cs.backgroundColor);
  return "body transparent; translucent selected tab; opaque image-backed overlay sidebar";
} finally {
  P.setBoolPref("vivaldifox.tabs.sidebarAutohide.enabled", false);
  P.clearUserPref("sidebar.verticalTabs");
  P.clearUserPref("sidebar.revamp");
}
