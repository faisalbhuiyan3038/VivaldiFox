// The finder narrows a broken site down to one extension using real notification buttons.
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
const install = name => AddonManager.installTemporaryAddon(new FileUtils.File(fixture(name)));
const addons = [await install("site-probe"), await install("toggle-a"), await install("toggle-b")];
await sleep(800);

const tab = await openTab(web("<title>finder</title>finder"));
gBrowser.selectedTab = tab;
await sleep(200);
const box = gBrowser.getNotificationBox(tab.linkedBrowser);
const note = () => box.getNotificationWithValue("vfx-extension-finder");
const text = () => note()?.messageText?.textContent || note()?.label || "";
const press = async label => {
  const n = await waitFor(() => {
    const cur = note();
    return cur && [...cur.buttonContainer.querySelectorAll("button")].some(b => b.label === label) && cur;
  }, "button " + label);
  [...n.buttonContainer.querySelectorAll("button")].find(b => b.label === label).click();
  await waitFor(() => note() !== n, "next step");
  await sleep(150);
};
const blockedNow = () => inContent(tab, `return content.document.documentElement.getAttribute("data-vfx-probe");`);
const sharedRules = () => Services.ppmm.sharedData.get("vivaldifox/extensionSiteRules")?.rules || {};

/** The site is "broken" while the probe extension runs on it. */
const runFinder = async () => {
  VivaldiFox.Commands.run("extensions.siteRules.find", win);
  for (let i = 0; i < 8; i++) {
    await waitFor(() => note(), "finder question");
    await sleep(500);
    const labels = [...note().buttonContainer.querySelectorAll("button")].map(b => b.label);
    if (!labels.includes("Works Now")) return labels;
    await press((await blockedNow()) === null ? "Works Now" : "Still Broken");
  }
  throw new Error("finder did not finish");
};

try {
  const labels = await runFinder();
  assert(labels.includes("Keep Off on This Site"), "one extension found: " + labels);
  assert(text().includes("site probe"), "names the probe extension: " + text());
  assert(!Object.keys(sharedRules()).length, "trial blocks are gone once the search ends");
  await press("Keep Off on This Site");
  await waitFor(async () => (await blockedNow()) === null && Object.values(sharedRules()).flat().includes("vfx-site-probe@test"), "rule saved");
  assert(!Object.values(sharedRules()).flat().includes("vfx-toggle-a@test"), "only the culprit is kept off");

  // With no extension to blame, the finder says so instead of naming one.
  const popup = $("#vfx-extension-sites").querySelector("menupopup");
  popup.dispatchEvent(new win.CustomEvent("popupshowing"));
  [...popup.querySelectorAll("menuitem")].find(m => m.getAttribute("label") === "Clear Rules for This Site").doCommand();
  await sleep(800);
  VivaldiFox.Commands.run("extensions.siteRules.find", win);
  await waitFor(() => note(), "first question");
  await press("Still Broken");
  await waitFor(() => /did not fix/.test(text()), "reports the cause is elsewhere");
  await press("Dismiss").catch(() => {});

  // Cancel leaves no trial rules behind.
  VivaldiFox.Commands.run("extensions.siteRules.find", win);
  await waitFor(() => note() && Object.keys(sharedRules()).length, "trial running");
  await press("Cancel");
  await waitFor(() => !Object.keys(sharedRules()).length, "trial rules removed on cancel");

  // Closing the bar with its X button ends the search the same way.
  VivaldiFox.Commands.run("extensions.siteRules.find", win);
  await waitFor(() => note() && Object.keys(sharedRules()).length, "trial running again");
  note().closeButton.click();
  await waitFor(() => !Object.keys(sharedRules()).length, "trial rules removed when the bar is closed");
  return "culprit found, saved, outside-cause, cancel and close paths verified";
} finally {
  for (const a of addons) await a.uninstall();
}
