/* MPL-2.0. I5: single-key shortcuts (no modifier), active only while the
 * keyboard focus is not in a text field. Vivaldi defaults: 1/2 switch tabs,
 * Z/X go back/forward. */
import { installKeymap, normalizeMap, isTyping } from "../../core/keys.sys.mjs";

export default {
  window(win, scope, ctx) {
    const map = normalizeMap(ctx.opt("map"));
    installKeymap(scope, win, {
      map: () => map,
      // Bare keys (Shift allowed for symbols) and never while typing.
      when: e => !e.ctrlKey && !e.altKey && !e.metaKey && !isTyping(win),
      run: (id, w) => !!ctx.Commands.get(id) && ctx.Commands.run(id, w),
    });
    win.vfxSingleKey = { isTyping: () => isTyping(win) };
    scope.add(() => delete win.vfxSingleKey);
  },
};
