/* MPL-2.0. S4: clock widget with a simple countdown timer. */
import { h } from "../../core/ui.sys.mjs";

const ID = "vfx-clock";
/** Shared across windows: end time (ms) of the running countdown, or 0. */
let countdownEnd = 0;

function format(ctx, now = new Date()) {
  const opts = { hour: "2-digit", minute: "2-digit", hour12: !ctx.opt("hour24") };
  if (ctx.opt("seconds")) opts.second = "2-digit";
  let s = now.toLocaleTimeString(undefined, opts);
  if (ctx.opt("date")) s = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + "  " + s;
  return s;
}

function remaining() {
  const ms = countdownEnd - Date.now();
  if (ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function notifyDone(win) {
  try {
    const alert = Cc["@mozilla.org/alert-notification;1"].createInstance(Ci.nsIAlertNotification);
    alert.init("vfx-clock", "", "Timer finished", "Your VivaldiFox countdown has ended.");
    Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService).showAlert(alert);
  } catch (e) {
    // No system notification available: the widget flash below is the fallback.
  }
  for (const w of Services.wm.getEnumerator("navigator:browser")) {
    const node = w.document.getElementById(ID);
    if (node) {
      node.setAttribute("vfx-alarm", "true");
      w.setTimeout(() => node.removeAttribute("vfx-alarm"), 10000);
    }
  }
}

export default {
  start(scope, ctx) {
    ctx.widget(scope, {
      id: ID, type: "custom", label: "Clock", tooltip: "Clock (click for timer)",
      area: ctx.isRunning("statusbar") ? "vfx-statusbar" : ctx.CustomizableUI.AREA_NAVBAR,
      onBuild(doc) {
        const label = h(doc, "label", { class: "vfx-clock-label", value: format(ctx) });
        const popup = h(doc, "menupopup");
        for (const min of [1, 5, 10, 15, 25, 45, 60]) {
          popup.append(h(doc, "menuitem", { label: `Countdown ${min} min`, oncommand: () => { countdownEnd = Date.now() + min * 60000; } }));
        }
        popup.append(h(doc, "menuseparator"));
        popup.append(h(doc, "menuitem", { label: "Cancel Countdown", oncommand: () => { countdownEnd = 0; } }));
        const item = h(doc, "toolbaritem", { removable: "true", title: "Clock", align: "center" }, [label, popup]);
        label.addEventListener("click", e => { if (e.button === 0) popup.openPopup(label, "before_end"); });
        return item;
      },
    });
    scope.add(() => { countdownEnd = 0; });
  },
  window(win, scope, ctx) {
    const doc = win.document;
    const tick = () => {
      const node = doc.getElementById(ID);
      const label = node?.querySelector(".vfx-clock-label");
      if (!label) return;
      if (countdownEnd && countdownEnd <= Date.now()) {
        countdownEnd = 0;
        notifyDone(win);
      }
      label.setAttribute("value", remaining() || format(ctx));
      label.setAttribute("tooltiptext", new Date().toLocaleString());
    };
    scope.interval(win, tick, 1000);
    win.setTimeout(tick, 0);
    win.vfxClock = { tick, format: d => format(ctx, d), startCountdown: s => { countdownEnd = Date.now() + s * 1000; } };
    scope.add(() => delete win.vfxClock);
  },
};
