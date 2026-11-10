// prefs: {"map": {"ctrl+alt+shift+9": "newTab", "Ctrl+Alt+Shift+8": "no.such.command"}}
const n = gBrowser.tabs.length;
const e = keydown(doc.documentElement, "9", { ctrlKey: true, altKey: true, shiftKey: true });
await waitFor(() => gBrowser.tabs.length === n + 1, "mapped command ran");
assert(e.defaultPrevented, "mapped key consumed");
const e2 = keydown(doc.documentElement, "8", { ctrlKey: true, altKey: true, shiftKey: true });
assert(!e2.defaultPrevented, "unknown command falls through");
const e3 = keydown(doc.documentElement, "7", { ctrlKey: true, altKey: true, shiftKey: true });
assert(!e3.defaultPrevented, "unmapped key untouched");
return "combo normalized and ran newTab; unknown/unmapped keys left alone";
