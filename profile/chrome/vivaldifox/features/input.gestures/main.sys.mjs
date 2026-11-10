/* MPL-2.0. I1: mouse gestures. Hold the right button, draw, release.
 *
 * Implemented in the browser chrome, so gestures also work over pages where
 * extensions are not allowed (about: pages, AMO, PDF viewer). The stroke is
 * reduced to a string of U/D/L/R segments and looked up in the `map` option.
 * Concept shared by many gesture add-ons; code written for this project.
 */
import { contextMenuBlocker, overContent } from "../../core/pointer.sys.mjs";

const XHTML = "http://www.w3.org/1999/xhtml";

/** Reduce a point list to direction letters, e.g. "DR". */
export function recognize(points, threshold = 14) {
  let out = "", ax = points[0]?.x ?? 0, ay = points[0]?.y ?? 0;
  for (const p of points) {
    const dx = p.x - ax, dy = p.y - ay;
    if (Math.hypot(dx, dy) < threshold) continue;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U");
    if (out.at(-1) !== dir) out += dir;
    ax = p.x;
    ay = p.y;
  }
  return out;
}

export default {
  start(scope) {
    // Context menus must open on mouse-up everywhere, otherwise (Linux, macOS)
    // the menu would appear before the gesture starts. Windows already does this.
    scope.nativePref("ui.context_menus.after_mouseup", true);
  },
  window(win, scope, ctx) {
    const doc = win.document;
    const map = ctx.opt("map") || {};
    const trail = ctx.opt("trail");
    const block = contextMenuBlocker(scope, win);
    let points = null, canvas = null;

    const endTrail = () => {
      canvas?.remove();
      canvas = null;
    };
    const drawTrail = () => {
      if (!trail || points.length < 2) return;
      if (!canvas) {
        canvas = doc.createElementNS(XHTML, "canvas");
        canvas.id = "vfx-gesture-trail";
        canvas.width = win.innerWidth;
        canvas.height = win.innerHeight;
        doc.documentElement.append(canvas);
      }
      const g = canvas.getContext("2d");
      const a = points.at(-2), b = points.at(-1);
      g.strokeStyle = win.getComputedStyle(doc.documentElement).getPropertyValue("--vfx-gesture-color").trim() || "#4c8bf5";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    };

    scope.listen(win, "mousedown", e => {
      // Right button alone; a left+right combination belongs to rocker gestures.
      points = e.button === 2 && e.buttons === 2 && overContent(e) ? [{ x: e.clientX, y: e.clientY }] : null;
      endTrail();
    }, true);
    scope.listen(win, "mousemove", e => {
      if (!points) return;
      if (!(e.buttons & 2)) {
        points = null;
        endTrail();
        return;
      }
      points.push({ x: e.clientX, y: e.clientY });
      drawTrail();
    }, true);
    scope.listen(win, "mouseup", e => {
      if (!points || e.button !== 2) return;
      const stroke = recognize(points);
      points = null;
      endTrail();
      if (!stroke) return; // a plain right-click: let the context menu open
      block();
      const id = map[stroke];
      if (id) ctx.Commands.run(id, win);
      win.vfxGestures.last = { stroke, command: id || null };
    }, true);
    scope.add(endTrail);

    win.vfxGestures = { recognize, last: null };
    scope.add(() => delete win.vfxGestures);
  },
};
