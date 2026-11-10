// prefs: {"seconds": true}
const node = await waitFor(() => $("#vfx-clock"), "widget");
const label = node.querySelector("label");
await waitFor(() => /\d{1,2}.\d{2}.\d{2}/.test(label.getAttribute("value")), "time with seconds: " + label.getAttribute("value"));
const a = label.getAttribute("value");
await waitFor(() => label.getAttribute("value") !== a, "clock ticks", 3000);
win.vfxClock.startCountdown(2);
await waitFor(() => label.getAttribute("value").startsWith("⏱"), "countdown shown");
await waitFor(() => node.hasAttribute("vfx-alarm"), "alarm fired", 5000);
node.removeAttribute("vfx-alarm");
return "clock ticks with seconds; 2 s countdown fired the alarm";
