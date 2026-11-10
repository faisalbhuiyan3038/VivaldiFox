/* MPL-2.0. L6: Vivaldi-style menu button. One button that opens the whole
 * classic menu (File, Edit, View, History, Bookmarks, Tools, Help) as a
 * cascading popup.
 *
 * The real <menu> elements of Firefox's menu bar are *lent* to the popup
 * while it is open and returned afterwards, so every item keeps its native
 * behaviour and nothing has to be re-implemented or kept in sync.
 */
import { h, icon } from "../../core/ui.sys.mjs";

function attach(node) {
  const doc = node.ownerDocument, win = doc.defaultView;
  const bar = doc.getElementById("main-menubar");
  if (!bar) return;
  node.setAttribute("type", "menu");
  node.setAttribute("wantdropmarker", "false");
  const popup = h(doc, "menupopup", { id: "vfx-menu-popup" });
  let lent = [];
  const giveBack = () => {
    for (const m of lent) bar.append(m);
    lent = [];
  };
  popup.addEventListener("popupshowing", e => {
    if (e.target !== popup) return;
    giveBack();
    lent = [...bar.children].filter(c => c.localName === "menu");
    popup.append(...lent);
  });
  popup.addEventListener("popuphidden", e => {
    if (e.target !== popup) return;
    // After the current event, so a clicked item finishes its command first.
    win.setTimeout(giveBack, 0);
  });
  popup.addEventListener("command", e => e.stopPropagation());
  node.append(popup);
  node.vfxGiveBack = giveBack;
}

export default {
  start(scope, ctx) {
    ctx.widget(scope, {
      id: "vfx-menu-button", label: "Menu", tooltip: "Main menu", icon: icon("menu"),
      area: ctx.CustomizableUI.AREA_TABSTRIP, overflows: false,
      onCreated: attach,
    });
    // Return the menus before the widget node is destroyed.
    scope.add(() => {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        try { win.document.getElementById("vfx-menu-button")?.vfxGiveBack?.(); } catch {}
      }
    });
  },
  window(win, scope) {
    // Destroying a widget removes its node: make sure menus are home first.
    scope.add(() => { try { win.document.getElementById("vfx-menu-button")?.vfxGiveBack?.(); } catch {} });
  },
};
