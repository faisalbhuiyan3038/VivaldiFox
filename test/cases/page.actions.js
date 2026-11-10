await waitFor(() => $("#vfx-page-actions"), "widget");
const t = await openTab(page("<title>pa</title><p>hello</p>")); gBrowser.selectedTab = t;
win.vfxPageActions.toggle("grayscale"); win.vfxPageActions.toggle("monospace");
// Verify from the pixels: load a red page and check it renders gray.
t.linkedBrowser.loadURI(Services.io.newURI(page("<title>red</title><body style='background:rgb(255,0,0);margin:0'>")), { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
await waitFor(() => t.linkedBrowser.contentTitle === "red", "navigated");
const sample = async () => {
  const bmp = await t.linkedBrowser.browsingContext.currentWindowGlobal.drawSnapshot(new win.DOMRect(0, 0, 20, 20), 1, "white");
  const c = doc.createElementNS("http://www.w3.org/1999/xhtml", "canvas"); c.width = c.height = 20;
  c.getContext("2d").drawImage(bmp, 0, 0); return [...c.getContext("2d").getImageData(5, 5, 1, 1).data].slice(0, 3);
};
const gray = await waitFor(async () => { const p = await sample(); return Math.abs(p[0] - p[1]) < 6 && Math.abs(p[1] - p[2]) < 6 && p; }, "page rendered grayscale after navigation");
win.vfxPageActions.clear();
const red = await waitFor(async () => { const p = await sample(); return p[0] > 200 && p[1] < 60 && p; }, "filter removed");
return "grayscale re-applied on navigation (pixel " + gray + "), cleared back to " + red;
