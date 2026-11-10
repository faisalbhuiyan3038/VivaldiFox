// prefs: {"image": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E", "toolbarOpacity": 40}
assert(doc.documentElement.hasAttribute("vfx-window-bg"), "attr");
const bi = win.getComputedStyle($("#navigator-toolbox")).backgroundImage;
assert(bi.startsWith("url("), "toolbox background image set: " + bi.slice(0, 40));
const nb = win.getComputedStyle($("#nav-bar")).backgroundColor;
assert(/rgba|color\(|\/ 0?\./.test(nb) || nb === "rgba(0, 0, 0, 0)", "nav bar translucent: " + nb);
return "image painted on the toolbox; nav bar translucent (" + nb + ")";
