/* MPL-2.0. I4: custom keyboard shortcuts for any command (Firefox's or the mod's).
 * The `map` option is { "Ctrl+Shift+Y": "commandId", ... }. Mapping a combo to
 * "none" disables whatever Firefox would do with it. */
import { installKeymap, normalizeMap } from "../../core/keys.sys.mjs";

export default {
  window(win, scope, ctx) {
    const map = normalizeMap(ctx.opt("map"));
    installKeymap(scope, win, {
      map: () => map,
      run: (id, w) => !!ctx.Commands.get(id) && ctx.Commands.run(id, w),
    });
  },
};
