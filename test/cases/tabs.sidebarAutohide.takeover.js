// Firefox's own expand-on-hover is switched off while the feature runs and
// restored afterwards, without changing the user's sidebar.visibility pref.
const P = Services.prefs;
const root = doc.documentElement;
P.setBoolPref("vivaldifox.tabs.sidebarAutohide.enabled", false);
P.setBoolPref("sidebar.revamp", true);
P.setBoolPref("sidebar.verticalTabs", true);
P.setStringPref("sidebar.visibility", "expand-on-hover");
try {
  await waitFor(() => root.hasAttribute("sidebar-expand-on-hover"), "Firefox expand-on-hover on");
  P.setBoolPref("vivaldifox.tabs.sidebarAutohide.enabled", true);
  await waitFor(() => root.getAttribute("vfx-sb-mode") === "hidden" && !root.hasAttribute("sidebar-expand-on-hover"), "taken over");
  assert(P.getStringPref("sidebar.visibility") === "expand-on-hover", "user pref untouched");
  P.setBoolPref("vivaldifox.tabs.sidebarAutohide.enabled", false);
  await waitFor(() => !root.hasAttribute("vfx-sb-mode") && root.hasAttribute("sidebar-expand-on-hover"), "Firefox expand-on-hover restored");
  P.setBoolPref("vivaldifox.tabs.sidebarAutohide.enabled", true);
  return "expand-on-hover suspended while on, restored when off; pref untouched";
} finally {
  P.clearUserPref("sidebar.visibility");
  P.clearUserPref("sidebar.verticalTabs");
  P.clearUserPref("sidebar.revamp");
}
