// needs a panel to float: enable notes for the duration of this case only
Services.prefs.setBoolPref("vivaldifox.panels.notes.enabled", true);
await sleep(400);
const tabbox = $("#tabbrowser-tabbox"); const w0 = tabbox.getBoundingClientRect().width;
VivaldiFox.Panels.open(win, "notes");
await sleep(300);
const box = $("#vfx-panel-box");
assert(win.getComputedStyle(box).position === "absolute", "panel is absolutely positioned");
assert(Math.abs(tabbox.getBoundingClientRect().width - w0) < 2, "page width unchanged by the open panel");
assert(box.getBoundingClientRect().width > 150, "panel visible");
// Hit-test real pixels: the panel must be on top of the page across its whole width.
const r = box.getBoundingClientRect();
for (const fx of [0.1, 0.5, 0.9]) {
  const hit = doc.elementFromPoint(r.left + r.width * fx, r.top + r.height / 2);
  assert(hit && box.contains(hit), "panel is on top of the page at " + Math.round(fx * 100) + "% of its width (hit: " + (hit?.id || hit?.localName) + ")");
}
VivaldiFox.Panels.close(win);
Services.prefs.setBoolPref("vivaldifox.panels.notes.enabled", false);
await sleep(300);
return "open panel overlays the page; page width unchanged";
