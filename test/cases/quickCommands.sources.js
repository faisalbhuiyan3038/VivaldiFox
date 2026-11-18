// Calculator, search keywords, settings, feature toggles, and a few of the new browser commands.
const QC = win.vfxQuickCommands;
const top = async q => { QC.open(); const st = QC.state; st.input.value = q; await st.update(); const items = st.items.slice(); QC.close(); return items; };
let r = await top("12*7+3");
assert(r[0].kind === "Calculator" && r[0].label === "= 87", "calculator: " + r[0].label);
r = await top("@wikipedia quokka");
assert(r[0].kind === "Search" && /Wikipedia/.test(r[0].label), "engine keyword: " + r[0].label);
r = await top("privacy");
assert(r[0].kind === "Settings", "settings page: " + r[0].label);
r = await top("gestures");
assert(r[0].kind === "VivaldiFox" && /Mouse gestures/.test(r[0].label), "feature toggle: " + r[0].label);
r = await top("license");
assert(!r.some(i => i.kind === "VivaldiFox"), "no loose feature-toggle matches");
// DevTools commands work although DevTools builds its menu lazily.
const open = () => !!doc.querySelector("[class*=devtools-toolbox]");
VivaldiFox.Commands.run("devTools", win);
await waitFor(open, "developer tools opened", 10000);
// A toggle while the toolbox is still loading is ignored by DevTools; let it settle.
await sleep(2000);
VivaldiFox.Commands.run("devTools", win);
await waitFor(() => !open(), "developer tools closed", 10000);
return "calculator, @keyword search, settings, feature toggles, devtools toggle";
