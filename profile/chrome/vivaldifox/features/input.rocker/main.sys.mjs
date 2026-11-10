/* MPL-2.0. I2: rocker gestures. Hold right + click left = back,
 * hold left + click right = forward (commands configurable). */
import { contextMenuBlocker, overContent } from "../../core/pointer.sys.mjs";

export default {
  start(scope) {
    scope.nativePref("ui.context_menus.after_mouseup", true);
  },
  window(win, scope, ctx) {
    const block = contextMenuBlocker(scope, win);
    let swallowClick = 0;
    scope.listen(win, "mousedown", e => {
      if (!overContent(e)) return;
      let id = null;
      // e.buttons holds every button down *including* the one just pressed.
      if (e.button === 0 && e.buttons === 3) id = ctx.opt("rightThenLeft");
      else if (e.button === 2 && e.buttons === 3) id = ctx.opt("leftThenRight");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      block(1200);
      swallowClick = Date.now() + 800;
      ctx.Commands.run(id, win);
      win.vfxRocker.last = id;
    }, true);
    // The click that completes a rocker must not also activate a link.
    scope.listen(win, "click", e => {
      if (Date.now() < swallowClick && overContent(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    win.vfxRocker = { last: null };
    scope.add(() => delete win.vfxRocker);
  },
};
