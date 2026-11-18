// Hiding the UI with vertical tabs hides the sidebar too; it comes back from its own edge.
const P = Services.prefs;
const root = doc.documentElement;
P.setBoolPref("sidebar.revamp", true);
P.setBoolPref("sidebar.verticalTabs", true);
try {
  await sleep(500);
  // With all features on, tabs.sidebarAutohide may already hold a mode; hiding the UI overrides it.
  const before = root.getAttribute("vfx-sb-mode");
  win.vfxAutohide.set(true);
  await waitFor(() => root.getAttribute("vfx-sb-mode") === "hidden", "sidebar hidden with the UI");
  const hz = $("#vfx-sb-hotzone");
  mouseAt(rect(hz).left + 2, rect(hz).top + 200);
  await waitFor(() => root.hasAttribute("vfx-sb-peek"), "sidebar revealed at its edge", 800);
  win.vfxAutohide.set(false);
  await waitFor(() => root.getAttribute("vfx-sb-mode") === before, "sidebar back to its previous state with the UI");
  return "UI hide also hides vertical tabs; edge reveal; restored on show";
} finally {
  win.vfxAutohide?.set(false);
  P.clearUserPref("sidebar.verticalTabs");
  P.clearUserPref("sidebar.revamp");
}
