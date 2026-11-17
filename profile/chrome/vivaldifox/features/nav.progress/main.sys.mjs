/* MPL-2.0. A4: page-load progress painted inside the address field.
 *
 * How accurate can it be? No browser knows a page's real progress: the total
 * amount of work only becomes known while the page loads (scripts discover
 * more requests, many responses have no Content-Length). Firefox reports the
 * top-level document's byte progress (curTotalProgress / maxTotalProgress),
 * which on its own is jumpy: often unknown (max <= 0), and the total grows as
 * requests are discovered. So the bar is an estimate built from several
 * signals, each only ever moving it forward:
 *   request started            10 %
 *   response committed         30 %   (onLocationChange: the page is now showing)
 *   bytes received             30 → 90 %, by Firefox's byte ratio when known
 *   time passing               creeps toward 90 % so it never looks frozen
 *   network activity stopped   100 %
 * Like Vivaldi's and Safari's bars, it tells you "still loading, roughly how
 * far", not an exact percentage.
 */
import { faviconColor } from "../look.accent/main.sys.mjs";

const RAINBOW = "rainbow";

export default {
  window(win, scope, ctx) {
    const gB = win.gBrowser, doc = win.document, urlbar = doc.getElementById("urlbar");
    if (!urlbar) return;
    const bg = urlbar.querySelector(".urlbar-background");

    // ── Appearance ──
    const style = ctx.opt("style") === "line" ? "line" : "fill";
    const colorMode = ctx.opt("color");
    let alpha = Math.max(10, Math.min(ctx.opt("opacity"), 100)) / 100;
    if (style === "line") alpha = Math.max(alpha, 0.85); // a 2px line needs to be visible
    scope.attr(urlbar, "vfx-progress-style", style);
    scope.attr(urlbar, "vfx-progress-color", colorMode === RAINBOW ? RAINBOW : "solid");
    scope.cssVar(urlbar, "--vfx-progress-alpha", String(alpha));
    // The bar is a pseudo-element of .urlbar-background; it needs a positioned parent.
    if (bg && win.getComputedStyle(bg).position === "static") scope.attr(urlbar, "vfx-progress-pos", "true");

    let fixedColor = "AccentColor";
    if (colorMode === "custom") {
      const c = String(ctx.opt("customColor") || "").trim();
      fixedColor = c && win.CSS.supports("color", c) ? c : "AccentColor";
    }
    /** Per-page colour for "page" mode: browser.permanentKey -> css colour */
    const pageColors = new WeakMap();
    const colorFor = browser => {
      if (colorMode !== "page") return fixedColor;
      // look.accent (when on) already knows the page's theme-color.
      return pageColors.get(browser.permanentKey) || "var(--vfx-accent, AccentColor)";
    };
    const learnPageColor = async tab => {
      if (colorMode !== "page" || !tab?.linkedBrowser) return;
      const key = tab.linkedBrowser.permanentKey;
      const rgb = await faviconColor(win, gB.getIcon(tab));
      if (rgb) pageColors.set(key, `rgb(${rgb.join(" ")})`);
      else pageColors.delete(key);
      if (tab.linkedBrowser === gB.selectedBrowser) paint();
    };
    if (colorMode === "page") {
      scope.listen(gB.tabContainer, "TabAttrModified", e => {
        if ((e.detail?.changed || []).includes("image")) learnPageColor(e.target);
      });
      learnPageColor(gB.selectedTab);
    }

    // ── Progress model ──
    /** browser -> { p, done, timer } */
    const loads = new Map();
    const START = 0.1, COMMIT = 0.3, BYTES_END = 0.9, CREEP_END = 0.9;

    const paint = () => {
      const st = loads.get(gB.selectedBrowser);
      if (!st) {
        urlbar.removeAttribute("vfx-loading");
        urlbar.style.removeProperty("--vfx-progress");
        return;
      }
      urlbar.setAttribute("vfx-loading", st.done ? "done" : "true");
      urlbar.style.setProperty("--vfx-progress", `${(st.p * 100).toFixed(1)}%`);
      urlbar.style.setProperty("--vfx-progress-color-value", colorFor(gB.selectedBrowser));
    };
    const bump = (browser, p) => {
      const st = loads.get(browser);
      if (!st || st.done || p <= st.p) return;
      st.p = Math.min(p, 0.97);
      if (browser === gB.selectedBrowser) paint();
    };
    const begin = browser => {
      const old = loads.get(browser);
      if (old) win.clearTimeout(old.timer);
      loads.set(browser, { p: START, done: false, timer: 0 });
      ensureCreep();
      if (browser === gB.selectedBrowser) paint();
    };
    const finish = browser => {
      const st = loads.get(browser);
      if (!st) return;
      st.p = 1;
      st.done = true;
      if (browser === gB.selectedBrowser) paint();
      win.clearTimeout(st.timer);
      st.timer = win.setTimeout(() => {
        if (loads.get(browser) === st) loads.delete(browser);
        if (browser === gB.selectedBrowser) paint();
      }, 450);
    };

    // Time-based creep: eases toward CREEP_END, slower the closer it gets.
    let creep = 0;
    function ensureCreep() {
      if (creep) return;
      creep = win.setInterval(() => {
        let active = false;
        for (const [browser, st] of loads) {
          if (st.done) continue;
          active = true;
          if (st.p < CREEP_END) bump(browser, st.p + (CREEP_END - st.p) * 0.025);
        }
        if (!active) { win.clearInterval(creep); creep = 0; }
      }, 200);
    }

    const F = Ci.nsIWebProgressListener;
    const listener = {
      onStateChange(browser, wp, _req, flags) {
        if (!wp?.isTopLevel || !(flags & F.STATE_IS_NETWORK)) return;
        if (flags & F.STATE_START) begin(browser);
        else if (flags & F.STATE_STOP) finish(browser);
      },
      onLocationChange(browser, wp, _req, _uri, flags) {
        if (!wp?.isTopLevel || (flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT)) return;
        bump(browser, COMMIT);
      },
      onProgressChange(browser, _wp, _req, _cs, _ms, cur, max) {
        if (!loads.has(browser) || max <= 0 || cur < 0) return;
        bump(browser, COMMIT + (BYTES_END - COMMIT) * Math.min(1, cur / max));
      },
    };
    gB.addTabsProgressListener(listener);
    scope.add(() => {
      try { gB.removeTabsProgressListener(listener); } catch {}
      if (creep) win.clearInterval(creep);
      for (const st of loads.values()) win.clearTimeout(st.timer);
      loads.clear();
      urlbar.removeAttribute("vfx-loading");
      urlbar.style.removeProperty("--vfx-progress");
      urlbar.style.removeProperty("--vfx-progress-color-value");
    });
    scope.listen(gB.tabContainer, "TabSelect", e => { paint(); learnPageColor(e.target); });
    scope.listen(gB.tabContainer, "TabClose", e => {
      const b = e.target.linkedBrowser, st = b && loads.get(b);
      if (st) { win.clearTimeout(st.timer); loads.delete(b); }
    });
  },
};
