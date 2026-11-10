/* MPL-2.0. A2: Page Actions (per-tab CSS filters) toolbar menu. */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";
import { contentScript, tell, listen } from "../../core/content.sys.mjs";

/** id -> { label, filter? (combined into one html filter), css? (extra rules) } */
export const ACTIONS = {
  grayscale: { label: "Filter: Grayscale", filter: "grayscale(1)" },
  sepia: { label: "Filter: Sepia", filter: "sepia(1)" },
  invert: {
    label: "Filter: Invert",
    filter: "invert(1) hue-rotate(180deg)",
    // Re-invert media so photos and video keep their real colours.
    css: "img, video, picture, canvas, svg image { filter: invert(1) hue-rotate(180deg) !important; }",
  },
  contrast: { label: "Filter: High Contrast", filter: "contrast(1.5)" },
  dim: { label: "Filter: Dim", filter: "brightness(0.7)" },
  obscure: { label: "Filter: Obscure (blur until hovered)", css: "html:not(:hover) body { filter: blur(8px) !important; }" },
  monospace: { label: "Fonts: Monospace", css: "* { font-family: monospace !important; }" },
  noImages: { label: "Content: Hide Images", css: "img, picture, video, svg, [style*='background-image'] { visibility: hidden !important; }" },
  noTransitions: { label: "Content: No Transitions or Animations", css: "*, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }" },
  outlines: { label: "Debug: Element Outlines", css: "* { outline: 1px solid rgba(255, 0, 80, 0.4) !important; }" },
  noSticky: { label: "Content: Unstick Fixed Elements", css: "*:not(html):not(body) { position: revert !important; }" },
};

export function buildCSS(ids) {
  const filters = [], rules = [];
  for (const id of ids) {
    const a = ACTIONS[id];
    if (!a) continue;
    if (a.filter) filters.push(a.filter);
    if (a.css) rules.push(a.css);
  }
  if (filters.length) rules.unshift(`html { filter: ${filters.join(" ")} !important; }`);
  return rules.join("\n");
}

/** browser.permanentKey -> string[] of active action ids (per tab, per session). */
const tabState = new WeakMap();

const push = browser => tell(browser, "vfx:pa:apply", buildCSS(tabState.get(browser.permanentKey) || []));

function toggle(browser, id) {
  const cur = new Set(tabState.get(browser.permanentKey) || []);
  cur.has(id) ? cur.delete(id) : cur.add(id);
  tabState.set(browser.permanentKey, [...cur]);
  push(browser);
}

function clear(browser) {
  tabState.delete(browser.permanentKey);
  push(browser);
}

export default {
  start(scope, ctx) {
    menuWidget(ctx, scope, {
      id: "vfx-page-actions", label: "Page Actions", tooltip: "Page actions (filters for this tab)", icon: icon("pageactions"),
      populate(popup, win) {
        const doc = win.document, browser = win.gBrowser.selectedBrowser;
        const cur = new Set(tabState.get(browser.permanentKey) || []);
        for (const [id, a] of Object.entries(ACTIONS)) {
          popup.append(h(doc, "menuitem", { type: "checkbox", label: a.label, checked: cur.has(id), closemenu: "none", oncommand: () => toggle(browser, id) }));
        }
        popup.append(h(doc, "menuseparator"));
        popup.append(h(doc, "menuitem", { label: "Clear All", oncommand: () => clear(browser) }));
      },
    });
    for (const [id, a] of Object.entries(ACTIONS)) {
      ctx.Commands.register(scope, { id: `page.action.${id}`, label: `Page action – ${a.label}`, run: w => toggle(w.gBrowser.selectedBrowser, id) });
    }
  },
  window(win, scope, ctx) {
    // The content script removes its own sheets when the feature is switched off.
    contentScript(scope, win, ctx.id);
    // A tab that moved to a new process (cross-site navigation) asks for its state.
    listen(scope, win, "vfx:pa:hello", (_d, browser) => {
      if (browser?.permanentKey && tabState.has(browser.permanentKey)) push(browser);
    });
    win.vfxPageActions = { toggle: id => toggle(win.gBrowser.selectedBrowser, id), clear: () => clear(win.gBrowser.selectedBrowser), ids: Object.keys(ACTIONS) };
    scope.add(() => delete win.vfxPageActions);
  },
};
