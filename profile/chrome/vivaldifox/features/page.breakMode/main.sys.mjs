/* MPL-2.0. A6: Break Mode. Pauses media everywhere and covers the browser until resumed. */
import { h, icon } from "../../core/ui.sys.mjs";

/** Media controllers this feature paused, so only those are resumed. */
let paused = [];
let active = false;

const windows = () => [...Services.wm.getEnumerator("navigator:browser")].filter(w => !w.closed && w.gBrowser);

function enter() {
  if (active) return;
  active = true;
  paused = [];
  for (const win of windows()) {
    for (const tab of win.gBrowser.tabs) {
      if (!tab.linkedPanel) continue;
      const mc = tab.linkedBrowser.browsingContext?.mediaController;
      try {
        if (mc?.isPlaying) {
          mc.pause();
          paused.push(mc);
        }
      } catch {}
    }
    cover(win);
  }
}

function leave() {
  if (!active) return;
  active = false;
  for (const win of windows()) win.document.getElementById("vfx-break-overlay")?.remove();
  for (const mc of paused) {
    try { mc.play(); } catch {}
  }
  paused = [];
}

function cover(win) {
  const doc = win.document;
  if (doc.getElementById("vfx-break-overlay")) return;
  const overlay = h(doc, "html:div", { id: "vfx-break-overlay", role: "dialog", "aria-label": "Break mode", tabindex: "0", onclick: leave, onkeydown: e => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") leave(); } }, [
    h(doc, "html:div", { class: "vfx-break-title", text: "Break Mode" }),
    h(doc, "html:div", { class: "vfx-break-hint", text: "Media is paused. Click anywhere or press Esc to continue." }),
  ]);
  doc.documentElement.append(overlay);
  overlay.focus();
}

export default {
  start(scope, ctx) {
    const toggle = () => (active ? leave() : enter());
    ctx.Commands.register(scope, { id: "page.breakMode", label: "Toggle break mode", run: toggle });
    ctx.widget(scope, { id: "vfx-break", label: "Break Mode", tooltip: "Take a break: pause media and hide the browser", icon: icon("break"), onCommand: toggle });
    scope.add(leave);
  },
  window(win, scope) {
    // Windows opened during a break are covered too.
    if (active) cover(win);
    win.vfxBreakMode = { enter, leave, get active() { return active; } };
    scope.add(() => delete win.vfxBreakMode);
  },
};
