await waitFor(() => $("#vfx-chains"), "widget");
assert(VivaldiFox.Commands.get("chain.example"), "chain registered as a command");
const n = gBrowser.tabs.length;
VivaldiFox.Commands.run("chain.example", win);
await waitFor(() => gBrowser.tabs.length === n + 1, "step 1: new tab");
await waitFor(() => doc.activeElement?.closest?.("#urlbar") || win.gURLBar.focused, "step 3: address bar focused");
return "example chain ran its steps in order";
