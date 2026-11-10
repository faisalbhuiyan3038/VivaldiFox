// prefs: {"lightStart": "00:00", "darkStart": "23:59"}
const { pick, parseTime } = ChromeUtils.importESModule("chrome://vivaldifox/content/features/look.themeSchedule/main.sys.mjs");
assert(parseTime("07:30") === 450 && parseTime("25:00") === null && parseTime("x") === null, "parseTime");
assert(pick(600, 420, 1140) === "light" && pick(1200, 420, 1140) === "dark" && pick(60, 420, 1140) === "dark", "day schedule");
assert(pick(60, 1320, 360) === "light" && pick(700, 1320, 360) === "dark", "overnight light schedule");
const AM = win.AddonManager;
const light = await AM.getAddonByID("firefox-compact-light@mozilla.org");
assert(light, "built-in light theme exists in this Firefox");
const d = new Date();
if (d.getHours() === 23 && d.getMinutes() === 59) return "skipped integration at 23:59; unit checks passed";
await waitFor(async () => (await AM.getAddonByID("firefox-compact-light@mozilla.org")).isActive, "light theme activated by schedule");
Services.prefs.setBoolPref("vivaldifox.look.themeSchedule.enabled", false);
await waitFor(async () => !(await AM.getAddonByID("firefox-compact-light@mozilla.org")).isActive, "previous theme restored on disable");
return "schedule maths correct; light theme applied by schedule and previous theme restored";
