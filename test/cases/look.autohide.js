const tb = $("#navigator-toolbox"), box = $("#tabbrowser-tabbox");
const top0 = box.getBoundingClientRect().top;
// Toolbars stay revealed while the address bar has focus (by design): start from the page.
win.gURLBar.blur(); gBrowser.selectedBrowser.focus(); await sleep(200);
VivaldiFox.Commands.run("look.toggleUI", win);
assert(doc.documentElement.getAttribute("vfx-ui-hidden") === "hover", "hidden (hover mode)");
await waitFor(() => box.getBoundingClientRect().top < 8, "page moved up to the top edge: " + box.getBoundingClientRect().top);
await waitFor(() => tb.getBoundingClientRect().bottom <= 6, "toolbox slid out: " + tb.getBoundingClientRect().bottom);
const e = keydown(doc.documentElement, "F11", { ctrlKey: true });
assert(e.defaultPrevented, "Ctrl+F11 handled");
await waitFor(() => !doc.documentElement.hasAttribute("vfx-ui-hidden") && Math.abs(box.getBoundingClientRect().top - top0) < 2, "UI restored");
return "toolbars slide away (page top " + top0 + "px -> ~4px) and return with Ctrl+F11";
