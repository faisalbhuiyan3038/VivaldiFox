// prefs: {"percent": 110}
// Extension popups fit their page at any interface zoom. Before the fix, every
// popup at 110 % had a ~43 device-pixel blank strip on its right.
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
const { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
Services.prefs.setBoolPref("extensions.openPopupWithoutUserGesture.enabled", true);
const addon = await AddonManager.installTemporaryAddon(new FileUtils.File(fixture("popup-probe")));
try {
  await sleep(1000);
  const ext = ExtensionParent.GlobalManager.getExtension(addon.id);
  await ExtensionParent.apiManager.global.browserActionFor(ext).openPopup(win);
  const b = await waitFor(() => [...doc.querySelectorAll("browser.webextension-popup-browser")].find(x => x.browsingContext && rect(x).width > 0), "popup open");
  await waitFor(() => /vw=\d+/.test(b.contentTitle), "popup reported its size");
  await sleep(800);
  const [, vw, vh, dpr] = /vw=(\d+) vh=(\d+) body=[\d.]+ dpr=([\d.]+)/.exec(b.contentTitle);
  const gapW = rect(b).width * win.devicePixelRatio - vw * dpr, gapH = rect(b).height * win.devicePixelRatio - vh * dpr;
  b.closest("panel")?.hidePopup();
  assert(Math.abs(gapW) < 3 && Math.abs(gapH) < 3, `popup box matches its page (gap ${gapW.toFixed(1)} x ${gapH.toFixed(1)} device px)`);
  return `gap ${gapW.toFixed(1)} x ${gapH.toFixed(1)} device px at 110 %`;
} finally {
  await addon.uninstall();
  Services.prefs.clearUserPref("extensions.openPopupWithoutUserGesture.enabled");
}
