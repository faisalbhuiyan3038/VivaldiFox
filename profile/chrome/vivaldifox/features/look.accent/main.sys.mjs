/* MPL-2.0. L1: accent colour from the page. The tab bar takes the colour of
 * the active page: its <meta name="theme-color"> when present, otherwise the
 * dominant colour of its favicon. Idea shared with Vivaldi and with the
 * "Adaptive Tab Bar Colour" extension (MIT); code written for this project. */
import { contentScript, listen } from "../../core/content.sys.mjs";

const XHTML = "http://www.w3.org/1999/xhtml";

/** "#rgb" / "#rrggbb" / "rgb(a)(...)" -> [r,g,b] or null. Uses a canvas so any CSS colour parses. */
function parseColor(win, str) {
  if (!str || typeof str !== "string" || str.length > 64) return null;
  if (!win.CSS.supports("color", str)) return null;
  const c = win.document.createElementNS(XHTML, "canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d");
  g.fillStyle = str;
  g.fillRect(0, 0, 1, 1);
  const [r, gg, b, a] = g.getImageData(0, 0, 1, 1).data;
  return a < 200 ? null : [r, gg, b];
}

/** Dominant saturated colour of an image URL, or null. */
export function faviconColor(win, url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const img = new win.Image();
    const timer = win.setTimeout(() => resolve(null), 2500);
    img.onerror = () => { win.clearTimeout(timer); resolve(null); };
    img.onload = () => {
      win.clearTimeout(timer);
      try {
        const c = win.document.createElementNS(XHTML, "canvas");
        c.width = c.height = 16;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data;
        let r = 0, gr = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
          // Weight by saturation so a colourful logo beats its white/black background.
          const wt = (max - min) / 255 + 0.02;
          r += d[i] * wt; gr += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
        }
        resolve(w > 0.5 ? [Math.round(r / w), Math.round(gr / w), Math.round(b / w)] : null);
      } catch { resolve(null); }
    };
    img.src = url;
  });
}

const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export default {
  window(win, scope, ctx) {
    const doc = win.document, root = doc.documentElement, gB = win.gBrowser;
    const useTheme = ctx.opt("themeColor"), useFavicon = ctx.opt("favicon");
    const strength = Math.max(10, Math.min(ctx.opt("strength"), 100));
    /** browser.permanentKey -> theme-color string reported by the page */
    const themeColors = new WeakMap();
    let token = 0;

    if (useTheme) {
      contentScript(scope, win, ctx.id);
      listen(scope, win, "vfx:accent:theme", (data, browser) => {
        if (!browser?.permanentKey) return;
        themeColors.set(browser.permanentKey, data?.color || "");
        if (browser === gB.selectedBrowser) update();
      });
    }

    const clear = () => {
      root.removeAttribute("vfx-accent");
      root.style.removeProperty("--vfx-accent");
      root.style.removeProperty("--vfx-accent-text");
    };
    const apply = rgb => {
      if (!rgb) return clear();
      root.style.setProperty("--vfx-accent", `rgb(${rgb.join(" ")})`);
      root.style.setProperty("--vfx-accent-text", luminance(rgb) > 0.55 ? "#15141a" : "#fbfbfe");
      root.style.setProperty("--vfx-accent-strength", strength + "%");
      root.setAttribute("vfx-accent", luminance(rgb) > 0.55 ? "light" : "dark");
    };
    const update = async () => {
      const my = ++token;
      const tab = gB.selectedTab, browser = tab.linkedBrowser;
      let rgb = useTheme ? parseColor(win, themeColors.get(browser.permanentKey)) : null;
      if (!rgb && useFavicon) rgb = await faviconColor(win, tab.getAttribute("image"));
      if (my === token) apply(rgb); // ignore results for a tab we already left
    };

    scope.listen(gB.tabContainer, "TabSelect", update);
    scope.listen(gB.tabContainer, "TabAttrModified", e => {
      if (e.target === gB.selectedTab && e.detail?.changed?.includes("image")) update();
    });
    scope.add(() => { token++; clear(); root.style.removeProperty("--vfx-accent-strength"); });
    update();
    win.vfxAccent = { update, parseColor: s => parseColor(win, s), faviconColor: u => faviconColor(win, u) };
    scope.add(() => delete win.vfxAccent);
  },
};
