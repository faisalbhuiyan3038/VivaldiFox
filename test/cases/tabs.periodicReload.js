const t = await openTab(page("<script>document.title = 't' + Date.now()</" + "script>x"));
assert($("#vfx-periodic-reload"), "submenu present");
const before = t.label;
win.vfxPeriodicReload.set(t, 1);
assert(t.getAttribute("vfx-periodic-reload") == "1", "tab marked");
await waitFor(() => t.label !== before && t.label.replace(/^\W+/, "").startsWith("t"), "reload happened", 6000);
win.vfxPeriodicReload.set(t, 0);
assert(!t.hasAttribute("vfx-periodic-reload"), "cleared");
return "tab reloaded on a 1 s interval, then stopped";
