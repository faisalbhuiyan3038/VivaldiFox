// prefs: {"mode": "strip"}
// Icon strip: favicons stay, hovering unclips the sidebar over the page.
const P = Services.prefs;
P.setBoolPref("sidebar.revamp", true);
P.setBoolPref("sidebar.verticalTabs", true);
const root = doc.documentElement;
try {
  await waitFor(() => root.getAttribute("vfx-sb-mode") === "strip", "strip mode active");
  const c = $("#sidebar-container"), main = c.querySelector("sidebar-main"), page = $("#tabbrowser-tabbox");
  const away = () => { const r = rect(page); mouseAt(r.left + r.width / 2, r.top + r.height / 2); };
  away();
  await sleep(400);
  const strip = parseFloat(root.style.getPropertyValue("--vfx-sb-strip"));
  assert(strip >= 40 && strip <= 80, "strip width measured from the favicon column: " + strip);
  assert(win.getComputedStyle(main).clipPath.startsWith("inset("), "launcher is clipped");
  const pageX = rect(page).left;
  assert(Math.abs(pageX - (rect(c).left + strip)) < 2, `page starts after the strip (${pageX} vs ${strip})`);
  const label = gBrowser.selectedTab.querySelector(".tab-label");
  const labelW = rect(label).width;

  mouseAt(rect(c).left + strip / 2, rect(c).top + 200);
  await waitFor(() => root.hasAttribute("vfx-sb-peek"), "hover expands it", 800);
  await sleep(300);
  assert(win.getComputedStyle(main).clipPath.includes("round"), "unclipped with rounded corners");
  assert(Math.abs(rect(page).left - pageX) < 1, "page did not move");
  assert(Math.abs(rect(label).width - labelW) < 0.5, "titles were not re-laid out");

  away();
  await waitFor(() => !root.hasAttribute("vfx-sb-peek"), "collapses after the pointer leaves", 1500);
  return `strip ${strip}px; hover unclips over the page without moving it or reflowing titles; collapses on leave`;
} finally {
  P.clearUserPref("sidebar.verticalTabs");
  P.clearUserPref("sidebar.revamp");
}
