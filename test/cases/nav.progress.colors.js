// prefs: {"color": "custom", "customColor": "rebeccapurple", "style": "line"}
// Custom colour in line style, and a staged (not jumpy) progress sequence.
const urlbar = $("#urlbar");
const seen = new Set();
const mo = new win.MutationObserver(() => { const v = urlbar.style.getPropertyValue("--vfx-progress"); if (v) seen.add(v); });
mo.observe(urlbar, { attributes: true, attributeFilter: ["style"] });
let pseudo = null;
const tab = gBrowser.selectedTab = gBrowser.addTab("about:blank", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
await sleep(200);
tab.linkedBrowser.loadURI(Services.io.newURI(web("<title>p</title>" + "x".repeat(20000))), { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
await waitFor(() => {
  if (urlbar.hasAttribute("vfx-loading") && !pseudo) pseudo = win.getComputedStyle(urlbar.querySelector(".urlbar-background"), "::after");
  return pseudo && !urlbar.hasAttribute("vfx-loading");
}, "load finished");
mo.disconnect();
const steps = [...seen];
assert(steps[0] === "10.0%", "starts at 10%: " + steps.join(" "));
assert(steps.includes("100.0%"), "ends at 100%");
assert(urlbar.getAttribute("vfx-progress-style") === "line", "line style");
return "steps: " + steps.join(" ");
