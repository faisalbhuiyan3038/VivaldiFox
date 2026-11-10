/* MPL-2.0. L2: scheduled themes. Switches between two installed Firefox
 * themes at set times of day. Uses the public AddonManager API; themes are
 * ordinary Firefox themes (built-in or from AMO), identified by add-on id. */
import { Fx } from "../../core/fx.sys.mjs";

/** "HH:MM" -> minutes since midnight, or null. */
export function parseTime(s) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(s));
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Which theme applies at `now` (minutes since midnight). */
export function pick(nowMin, lightStart, darkStart) {
  if (lightStart === null || darkStart === null || lightStart === darkStart) return "light";
  return lightStart < darkStart
    ? (nowMin >= lightStart && nowMin < darkStart ? "light" : "dark")
    : (nowMin >= darkStart && nowMin < lightStart ? "dark" : "light");
}

/** Restoring the previous theme is async; a restarted instance must wait for it. */
let pendingRestore = Promise.resolve();

export default {
  start(scope, ctx) {
    const AM = Fx.AddonManager;
    const ids = { light: ctx.opt("lightTheme"), dark: ctx.opt("darkTheme") };
    const lightStart = parseTime(ctx.opt("lightStart")), darkStart = parseTime(ctx.opt("darkStart"));
    let original = null, applied = null, stopped = false;

    const activeTheme = async () => (await AM.getAddonsByTypes(["theme"])).find(a => a.isActive)?.id || null;
    const apply = async () => {
      await pendingRestore;
      if (stopped) return;
      const d = new Date();
      const want = ids[pick(d.getHours() * 60 + d.getMinutes(), lightStart, darkStart)];
      if (!want) return;
      const addon = await AM.getAddonByID(want);
      // Re-check the real state every time instead of trusting a cached flag:
      // the user (or another add-on) may have switched themes in between.
      if (addon?.isActive) { applied = want; if (original === null) original = ""; return; }
      if (!addon) {
        console.warn(`[vivaldifox:look.themeSchedule] theme not installed: ${want}`);
        return;
      }
      if (original === null) original = (await activeTheme()) || "";
      if (stopped) return;
      if (!addon.isActive) await addon.enable();
      applied = want;
    };

    apply().catch(e => console.error("[vivaldifox:look.themeSchedule]", e));
    const timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback({ notify: () => apply().catch(() => {}) }, 30000, Ci.nsITimer.TYPE_REPEATING_SLACK);
    scope.add(() => {
      stopped = true;
      timer.cancel();
      // Put back the theme that was active before the schedule took over.
      if (original && original !== applied) pendingRestore = AM.getAddonByID(original).then(a => a?.enable()).catch(() => {});
    });
  },
};
