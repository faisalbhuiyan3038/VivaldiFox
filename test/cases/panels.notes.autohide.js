// Panel bar auto-hide (shared panel host): tucked at the edge, revealed by a command, toggled off and on.
const P = Services.prefs;
P.setBoolPref("vivaldifox.panels.autohide", true);
try {
  const panels = await waitFor(() => $("#vfx-panels"), "panel host");
  await waitFor(() => panels.hasAttribute("autohide"), "autohide attribute");
  // Pointer away from the window edge (a previous case may have left it there, which would reveal the bar).
  const page = rect($("#tabbrowser-tabbox"));
  mouseAt(page.left + page.width / 2, page.top + page.height / 2);
  await sleep(300);
  assert(rect(panels).right <= 6, "tucked away except a thin strip: right=" + rect(panels).right);
  VivaldiFox.Commands.run("panels.toggle", win);
  await waitFor(() => panels.hasAttribute("reveal"), "opening a panel reveals the bar");
  await sleep(300);
  assert(rect(panels).left >= -1, "fully on screen");
  VivaldiFox.Commands.run("panels.toggle", win);
  await waitFor(() => !panels.hasAttribute("reveal"), "closing hides it again");
  VivaldiFox.Commands.run("panels.toggleBar", win);
  await waitFor(() => win.getComputedStyle(panels).display === "none", "panel bar switched off");
  VivaldiFox.Commands.run("panels.toggleBar", win);
  await waitFor(() => win.getComputedStyle(panels).display !== "none", "and back on");
  return "panel bar auto-hide and show/hide toggle";
} finally {
  P.clearUserPref("vivaldifox.panels.autohide");
  P.clearUserPref("vivaldifox.panels.hidden");
}
