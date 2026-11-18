// The button switches all or selected extensions and restores only what it turned off.
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
const install = name => AddonManager.installTemporaryAddon(new FileUtils.File(fixture(name)));
const a = await install("toggle-a"), b = await install("toggle-b");
const on = x => !x.userDisabled;
const run = id => assert(VivaldiFox.Commands.run(id, win), "command ran: " + id);
const paused = () => VivaldiFox.opt("extensions.toggle", "paused");
try {
  const node = await waitFor(() => $("#vfx-extensions"), "widget");
  await waitFor(() => /of 2 on|of \d+ on/.test(node.getAttribute("tooltiptext")), "tooltip counts extensions");

  // All: everything goes off, and comes back.
  run("extensions.toggleAll");
  await waitFor(() => !on(a) && !on(b) && paused().length === 2, "all disabled");
  await waitFor(() => /extensionsoff/.test(node.style.listStyleImage), "icon shows off");
  run("extensions.toggleAll");
  await waitFor(() => on(a) && on(b) && !paused().length, "all restored");

  // Selected: only the chosen extension changes.
  VivaldiFox.setOpt("extensions.toggle", "selected", [a.id]);
  run("extensions.toggle");
  await waitFor(() => !on(a), "selected disabled");
  assert(on(b), "unselected extension untouched");
  run("extensions.toggle");
  await waitFor(() => on(a), "selected enabled");
  VivaldiFox.setOpt("extensions.toggle", "selected", []);

  // An extension the user disabled stays off after a restore.
  await b.disable();
  await sleep(200);
  run("extensions.toggleAll");
  await waitFor(() => !on(a), "a disabled");
  run("extensions.toggleAll");
  await waitFor(() => on(a), "a restored");
  await sleep(200);
  assert(!on(b), "user-disabled extension stays off");
  await b.enable();

  // The menu lists the extensions with their state.
  const popup = node.querySelector("menupopup");
  popup.dispatchEvent(new win.CustomEvent("popupshowing"));
  const labels = [...popup.children].map(m => m.getAttribute("label"));
  assert(labels.includes("Disable All Extensions"), "menu offers disable all");
  assert(labels.includes(a.name) && labels.includes(b.name), "menu lists extensions");

  // Switching the feature off gives back what the button turned off.
  run("extensions.toggleAll");
  await waitFor(() => !on(a) && !on(b) && paused().length === 2, "disabled before feature off");
  Services.prefs.setBoolPref("vivaldifox.extensions.toggle.enabled", false);
  await waitFor(() => on(a) && on(b), "restored when the feature is turned off");
  return "all, selected, user-disabled and feature-off paths verified";
} finally {
  Services.prefs.clearUserPref("vivaldifox.extensions.toggle.selected");
  Services.prefs.clearUserPref("vivaldifox.extensions.toggle.paused");
  await a.uninstall();
  await b.uninstall();
}
