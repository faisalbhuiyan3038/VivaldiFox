if (VivaldiFox.status().some(s => s.running)) return "skipped in all-on mode";
// 1. A corrupt option value (hand-edited in about:config) must not break the feature.
Services.prefs.setStringPref("vivaldifox.input.gestures.map", "{{{ definitely not json");
Services.prefs.setBoolPref("vivaldifox.input.gestures.enabled", true);
await sleep(400);
assert(st("input.gestures").running && !st("input.gestures").error, "feature runs with the default map");
assert(VivaldiFox.opt("input.gestures", "map").L === "back", "default used instead of corrupt value");
Services.prefs.clearUserPref("vivaldifox.input.gestures.map");
// 2. An unknown command id in a map is ignored, not fatal.
assert(VivaldiFox.Commands.run("no.such.command", win) === false, "unknown command returns false");
// 3. A command whose Firefox target vanished reports failure instead of throwing.
const saved = doc.getElementById("Browser:Reload"); const parent = saved.parentNode, next = saved.nextSibling; saved.remove();
assert(VivaldiFox.Commands.run("reload", win) === false, "missing native command handled");
assert(!VivaldiFox.Commands.list(win).some(c => c.id === "reload"), "and hidden from the command list");
parent.insertBefore(saved, next);
// 4. A second browser window gets the running features too, and cleans up when closed.
Services.prefs.setBoolPref("vivaldifox.statusbar.enabled", true);
await sleep(300);
const w2 = win.OpenBrowserWindow();
await waitFor(() => w2.document?.getElementById("vfx-statusbar"), "status bar in a newly opened window", 15000);
w2.close();
await waitFor(() => w2.closed, "second window closed");
assert($("#vfx-statusbar"), "first window unaffected");
// 5. The module resolver falls back to URLs and reports unknown modules clearly.
const { Fx } = ChromeUtils.importESModule("chrome://vivaldifox/content/core/fx.sys.mjs");
assert(Fx.SessionStore && Fx.CustomizableUI && Fx.PlacesUtils, "core Firefox modules resolved");
let threw = false; try { Fx.NoSuchModuleXyz; } catch (e) { threw = /not available/.test(e.message); }
assert(threw, "unknown module gives a clear error");
$("#vfx-toast")?.remove();
return "corrupt prefs, unknown/missing commands, new windows and module lookup all degrade safely";
