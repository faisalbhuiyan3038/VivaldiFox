// prefs: {"sites": [{"url": "http://127.0.0.1:1/placeholder", "title": "Local"}]}
const url = web("<title>WebPanel</title><script>document.title = 'UA:' + (navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop')</" + "script>wp");
VivaldiFox.setOpt("panels.web", "sites", [{ url, title: "Local", mobile: true }]);
await sleep(600);
const btn = await waitFor(() => $('.vfx-panel-btn[data-panel="web:0"]'), "site button");
assert($('.vfx-panel-btn[data-panel="web:add"]'), "add button");
btn.doCommand();
const node = await waitFor(() => $('.vfx-panel[data-panel="web:0"]'), "panel built");
const br = node.querySelector("browser");
assert(br.getAttribute("remote") === "true", "remote browser");
await waitFor(() => br.contentTitle === "UA:mobile", "site loaded in panel with mobile UA: " + br.contentTitle, 10000);
assert(br.isRemoteBrowser && br.browsingContext.currentWindowGlobal.osPid !== Services.appinfo.processID, "runs in a content process");
VivaldiFox.Panels.close(win); btn.doCommand();
assert(node.querySelector("browser") === br && br.contentTitle === "UA:mobile", "stays loaded when re-opened");
VivaldiFox.setOpt("panels.web", "sites", []);
await waitFor(() => !$('.vfx-panel-btn[data-panel="web:0"]'), "removed when the site list changes");
return "site loads in an out-of-process panel browser with mobile UA; list edits apply live";
