// prefs: {"mode": "hidden"}
// Arc-style hidden sidebar, driven with real pointer and keyboard input.
const P = Services.prefs;
P.setBoolPref("sidebar.revamp", true);
P.setBoolPref("sidebar.verticalTabs", true);
const root = doc.documentElement;
try {
  await waitFor(() => root.getAttribute("vfx-sb-mode") === "hidden", "hidden mode active once tabs are vertical");
  const c = $("#sidebar-container"), page = $("#tabbrowser-tabbox"), hz = $("#vfx-sb-hotzone");
  const away = () => { const r = rect(page); mouseAt(r.left + r.width / 2, r.top + r.height / 2); };
  away();
  await sleep(400);
  assert(rect(c).right <= 0, "sidebar off-screen while hidden: " + rect(c).right);
  const pageX = rect(page).left;
  assert(pageX < rect(c).width / 2, "page does not reserve the sidebar's width: x=" + pageX);

  // Touch the edge: slides in over the page, the page does not move.
  mouseAt(rect(hz).left + 2, rect(hz).top + 200);
  await waitFor(() => root.hasAttribute("vfx-sb-peek"), "revealed from the window edge", 600);
  await sleep(300);
  assert(rect(c).left >= 0 && rect(c).width > 150, "sidebar on screen: " + JSON.stringify(rect(c)));
  assert(Math.abs(rect(page).left - pageX) < 1, "page did not move when the sidebar appeared");

  // Leaving hides it, but only after the grace period.
  away();
  await sleep(120);
  assert(root.hasAttribute("vfx-sb-peek"), "still shown during the hide delay");
  await waitFor(() => !root.hasAttribute("vfx-sb-peek"), "hidden after the pointer left", 1500);

  // A menu opened from it keeps it open.
  mouseAt(rect(hz).left + 2, rect(hz).top + 200);
  await waitFor(() => root.hasAttribute("vfx-sb-peek"), "revealed again");
  const menu = $("#tabContextMenu");
  const shown = new Promise(r => menu.addEventListener("popupshown", r, { once: true }));
  menu.openPopup(gBrowser.selectedTab, "after_start");
  await shown;
  away();
  await sleep(700);
  assert(root.hasAttribute("vfx-sb-peek"), "stays open while its context menu is open");
  menu.hidePopup();
  await waitFor(() => !root.hasAttribute("vfx-sb-peek"), "hides once the menu closes", 1500);

  // Esc dismisses a peek.
  mouseAt(rect(hz).left + 2, rect(hz).top + 200);
  await waitFor(() => root.hasAttribute("vfx-sb-peek"), "revealed for Esc");
  EU.synthesizeKey("KEY_Escape", {}, win);
  await waitFor(() => !root.hasAttribute("vfx-sb-peek"), "Esc hides it", 800);
  away();

  // Ctrl+Alt+S pins it into the layout, and back.
  EU.synthesizeKey("s", { ctrlKey: true, altKey: true }, win);
  await waitFor(() => root.getAttribute("vfx-sb-mode") === "docked", "Ctrl+Alt+S pins");
  await sleep(300);
  assert(rect(page).left >= rect(c).right - 1, "pinned sidebar is in the layout, page beside it");
  // The native sidebar button pins / unpins too.
  $("#sidebar-button").doCommand();
  await waitFor(() => root.getAttribute("vfx-sb-mode") === "hidden", "sidebar button unpins");
  return "hidden; edge reveal over the page (page still); delayed hide; kept open by its menu; Esc; Ctrl+Alt+S and the sidebar button pin/unpin";
} finally {
  P.clearUserPref("vivaldifox.tabs.sidebarAutohide.pinned");
  P.clearUserPref("sidebar.verticalTabs");
  P.clearUserPref("sidebar.revamp");
}
