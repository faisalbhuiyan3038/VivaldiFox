/* MPL-2.0. I7: spatial navigation. Shift+Arrow moves focus to the nearest
 * link or control in that direction. All logic lives in content.js. */
import { contentScript } from "../../core/content.sys.mjs";

export default {
  window(win, scope, ctx) {
    contentScript(scope, win, ctx.id);
  },
};
