/* MPL-2.0. T11: closed-tabs "trash can" toolbar button. */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";

import { Fx } from "../../core/fx.sys.mjs";

function populate(popup, win, ctx) {
  const doc = win.document, SS = Fx.SessionStore;
  const max = ctx.opt("maxItems");
  let tabs = [];
  try { tabs = SS.getClosedTabDataForWindow(win); } catch (e) { console.error(e); }
  tabs.slice(0, max).forEach((t, i) => {
    const url = t.state?.entries?.at(-1)?.url;
    popup.append(h(doc, "menuitem", {
      class: "menuitem-iconic", label: t.title || url || "Tab",
      image: t.image || "chrome://global/skin/icons/defaultFavicon.svg",
      tooltiptext: url,
      oncommand: () => (t.closedId != null && SS.undoCloseById ? SS.undoCloseById(t.closedId) : SS.undoCloseTab(win, i)),
    }));
  });
  let wins = [];
  try { wins = SS.getClosedWindowData(); } catch {}
  if (wins.length) {
    if (popup.childElementCount) popup.append(h(doc, "menuseparator"));
    wins.slice(0, 5).forEach((w, i) => {
      const n = w.tabs?.length || 0;
      popup.append(h(doc, "menuitem", {
        label: `Window: ${w.title || "untitled"} (${n} tab${n === 1 ? "" : "s"})`,
        oncommand: () => (w.closedId != null && SS.undoCloseById ? SS.undoCloseById(w.closedId) : SS.undoCloseWindow(i)),
      }));
    });
  }
  if (tabs.length) {
    popup.append(h(doc, "menuseparator"));
    popup.append(h(doc, "menuitem", {
      label: "Empty Trash",
      oncommand: () => {
        // Always forget index 0: the list shifts after each removal.
        for (let n = SS.getClosedTabCountForWindow(win); n > 0; n--) {
          try { SS.forgetClosedTab(win, 0); } catch { break; }
        }
      },
    }));
  }
}

export default {
  start(scope, ctx) {
    menuWidget(ctx, scope, {
      id: "vfx-trash", label: "Closed Tabs", tooltip: "Recently closed tabs and windows",
      icon: icon("trash"), area: ctx.CustomizableUI.AREA_TABSTRIP,
      populate: (popup, win) => populate(popup, win, ctx),
    });
  },
};
