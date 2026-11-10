assert(win.vfxGestures.recognize([{x:0,y:0},{x:0,y:40},{x:0,y:80},{x:40,y:80},{x:90,y:80}]) === "DR", "recognizer DR");
assert(win.vfxGestures.recognize([{x:0,y:0},{x:3,y:2}]) === "", "tiny movement is not a gesture");
assert(Services.prefs.getBoolPref("ui.context_menus.after_mouseup"), "context menu on mouseup");
const t = await openTab(web("<title>G</title>gesture")); gBrowser.selectedTab = t;
const br = t.linkedBrowser, r = br.getBoundingClientRect(), x = r.x + 200, y = r.y + 100;
const n = gBrowser.tabs.length;
mouse(br, "mousedown", { button: 2, buttons: 2, clientX: x, clientY: y });
for (let i = 1; i <= 8; i++) mouse(br, "mousemove", { button: 0, buttons: 2, clientX: x, clientY: y + i * 12 });
assert($("#vfx-gesture-trail"), "trail drawn");
mouse(br, "mouseup", { button: 2, buttons: 0, clientX: x, clientY: y + 96 });
assert(win.vfxGestures.last?.stroke === "D", "stroke D: " + JSON.stringify(win.vfxGestures.last));
await waitFor(() => gBrowser.tabs.length === n + 1, "D opened a new tab");
assert(!$("#vfx-gesture-trail"), "trail removed");
// The context menu that would follow the mouseup is cancelled.
const menu = $("#contentAreaContextMenu");
const ev = new win.Event("popupshowing", { cancelable: true }); menu.dispatchEvent(ev);
assert(ev.defaultPrevented, "context menu suppressed after gesture");
// A toolbar right-click is not a gesture.
mouse($("#nav-bar"), "mousedown", { button: 2, buttons: 2, clientX: 5, clientY: 5 });
mouse($("#nav-bar"), "mousemove", { buttons: 2, clientX: 5, clientY: 90 });
assert(!$("#vfx-gesture-trail"), "no gesture outside content");
mouse($("#nav-bar"), "mouseup", { button: 2, clientX: 5, clientY: 90 });
return "stroke D recognized over content -> new tab; trail drawn/removed; context menu suppressed";
