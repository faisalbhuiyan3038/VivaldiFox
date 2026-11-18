// An extension kept off one site loses content scripts, webRequest and DNR there, and nowhere else.
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
const addon = await AddonManager.installTemporaryAddon(new FileUtils.File(fixture("site-probe")));
await sleep(800);

const siteA = html => web(html);                                       // 127.0.0.1
const siteB = html => web(html).replace("127.0.0.1", "localhost");     // a different site
const framed = src => `<title>start</title><script>addEventListener("message", e => { if (e.data === "vfx-probe-frame") document.title = "framed"; })</script><iframe src="${src}"></iframe>`;

const probe = tab => inContent(tab, `
  const doc = content.document;
  const req = async u => { try { await content.fetch(u); return "open"; } catch { return "blocked"; } };
  return { script: doc.documentElement.getAttribute("data-vfx-probe"), wr: await req("/html?b=vfx-wr-block"), dnr: await req("/html?b=vfx-dnr-block") };`);
const active = p => p.script === "1" && p.wr === "blocked" && p.dnr === "blocked";
const off = p => p.script === null && p.wr === "open" && p.dnr === "open";

const node = await waitFor(() => $("#vfx-extension-sites"), "widget");
const popup = node.querySelector("menupopup");
const menu = () => { popup.dispatchEvent(new win.CustomEvent("popupshowing")); return popup; };
const item = label => {
  const el = [...menu().querySelectorAll("menuitem")].find(m => m.getAttribute("label").startsWith(label));
  assert(el, "menu item: " + label);
  return el;
};
const reloaded = async (tab, act) => {
  const before = tab.linkedBrowser.browsingContext.currentWindowGlobal.innerWindowId;
  act();
  await waitFor(() => tab.linkedBrowser.browsingContext.currentWindowGlobal?.innerWindowId !== before && !tab.hasAttribute("busy"), "tab reloaded");
  await sleep(300);
};

try {
  const a = await openTab(siteA("<title>a</title>a")), b = await openTab(siteB("<title>b</title>b"));
  await sleep(300);
  assert(active(await probe(a)), "extension active on site A before any rule");

  // One extension off on site A only.
  gBrowser.selectedTab = a;
  await sleep(100);
  await reloaded(a, () => item("Off on 127.0.0.1").doCommand());
  assert(off(await probe(a)), "all three paths are off on site A: " + JSON.stringify(await probe(a)));
  assert(active(await probe(b)), "still active on site B");
  await waitFor(() => /extensionsiteoff/.test(node.style.listStyleImage), "icon marks the site");

  // A cross-site iframe inside site A is covered by the rule on its top-level page.
  const parentA = await openTab(siteA(framed(siteB("<title>f</title>f"))));
  await sleep(900);
  assert(parentA.linkedBrowser.contentTitle === "start", "no content script in a cross-site frame of site A");

  // A rule follows the tab's site: a site A frame inside site B still gets the extension.
  const parentB = await openTab(siteB(framed(siteA("<title>f</title>f"))));
  await waitFor(() => parentB.linkedBrowser.contentTitle === "framed", "content script runs in a site A frame under site B");

  // Clearing the rule brings everything back.
  gBrowser.selectedTab = a;
  await sleep(100);
  await reloaded(a, () => item("Clear Rules for This Site").doCommand());
  assert(active(await probe(a)), "active again after clearing");

  // A page rule covers that page only, and "all" covers every extension.
  await reloaded(a, () => item("Disable All on This Page").doCommand());
  assert(off(await probe(a)), "page rule applies");
  const samePage = await openTab(siteA("<title>same</title>same"));
  await sleep(300);
  assert(off(await probe(samePage)), "page rule ignores the query string");
  const otherPage = await openTab(siteA("<title>other</title>other").replace("/html?", "/other?"));
  await sleep(300);
  assert(active(await probe(otherPage)), "page rule leaves other pages of the site alone");
  gBrowser.selectedTab = a;
  await sleep(100);
  await reloaded(a, () => item("Clear Rules for This Site").doCommand());

  // Turning the feature off removes the hooks, and saved rules return with it.
  await reloaded(a, () => item("Disable All on 127.0.0.1").doCommand());
  assert(off(await probe(a)), "domain rule applies");
  Services.prefs.setBoolPref("vivaldifox.extensions.siteRules.enabled", false);
  await sleep(500);
  a.linkedBrowser.reload();
  await sleep(1200);
  assert(active(await probe(a)), "extension runs normally with the feature off");
  Services.prefs.setBoolPref("vivaldifox.extensions.siteRules.enabled", true);
  await waitFor(() => $("#vfx-extension-sites"), "widget back");
  await sleep(1500);
  assert(off(await probe(a)), "saved rule applies again when the feature returns");

  const again = $("#vfx-extension-sites").querySelector("menupopup");
  again.dispatchEvent(new win.CustomEvent("popupshowing"));
  [...again.querySelectorAll("menuitem")].find(m => m.getAttribute("label") === "Clear Rules for This Site").doCommand();
  await sleep(600);
  return "content scripts, webRequest and DNR gated per site; frames, page rules and feature off verified";
} finally {
  await addon.uninstall();
}
