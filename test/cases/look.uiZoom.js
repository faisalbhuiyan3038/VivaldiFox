// prefs: {"percent": 125}
assert(Math.abs(win.browsingContext.fullZoom - 1.25) < 0.01, "chrome zoom set: " + win.browsingContext.fullZoom);
const t = await openTab(web("<title>z</title>zoom")); gBrowser.selectedTab = t;
assert(Math.abs(win.ZoomManager.getZoomForBrowser(t.linkedBrowser) - 1) < 0.01, "page zoom still 100%");
const dprUI = win.devicePixelRatio, dprPage = await inContent(t, "return content.devicePixelRatio");
assert(dprUI > dprPage * 1.2, "UI scaled (" + dprUI + ") but page not (" + dprPage + ")");
Services.prefs.setBoolPref("vivaldifox.look.uiZoom.enabled", false);
await sleep(300);
assert(Math.abs(win.browsingContext.fullZoom - 1) < 0.01, "restored on disable");
return "interface at 125% (dpr " + dprUI + "), page content unchanged (dpr " + dprPage + ")";
