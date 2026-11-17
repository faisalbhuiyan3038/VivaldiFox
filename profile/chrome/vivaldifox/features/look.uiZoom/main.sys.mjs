/* MPL-2.0. L3: user-interface zoom. Scales the browser chrome only (toolbars,
 * tabs, menus) and leaves web pages at their own zoom, unlike the global
 * layout.css.devPixelsPerPx pref which scales everything.
 *
 * Extension popups: Firefox sizes a popup's <browser> to the page's measured
 * size times the popup's own zoom, written as inline width/height in chrome
 * pixels. That ignores the chrome's zoom, so at 110 % the box came out ~10 %
 * larger than the page inside it: an empty strip on the right and bottom.
 * Popups are given the interface zoom (so they scale with the rest of the
 * UI) and every size Firefox writes is divided by the chrome zoom, which is
 * the correct conversion whatever the popup's own zoom is. */
const POPUP_BROWSERS = "browser.webextension-popup-browser, browser[webextension-view-type='popup']";
const SIZE_PROPS = ["width", "min-width", "max-width", "height", "min-height", "max-height"];

export default {
  window(win, scope, ctx) {
    const pct = Math.max(50, Math.min(ctx.opt("percent"), 200));
    const zoom = pct / 100;
    const bc = win.browsingContext;
    if (!bc || !("fullZoom" in bc)) throw new Error("BrowsingContext.fullZoom is not available");
    const before = bc.fullZoom;
    bc.fullZoom = zoom;
    scope.add(() => { try { bc.fullZoom = before; } catch {} });

    if (zoom === 1) return;
    const doc = win.document;
    /** browser -> { observer, written: {prop: value we wrote} } */
    const tracked = new Map();

    // Rescale the sizes Firefox wrote; skip values that are our own writes.
    const correct = browser => {
      const t = tracked.get(browser);
      if (!t) return;
      for (const prop of SIZE_PROPS) {
        const v = browser.style.getPropertyValue(prop);
        const m = /^([\d.]+)px$/.exec(v);
        if (!m || v === t.written[prop]) continue;
        const fixed = `${Math.round((parseFloat(m[1]) / zoom) * 100) / 100}px`;
        t.written[prop] = fixed;
        browser.style.setProperty(prop, fixed);
      }
    };
    const fit = browser => {
      if (scope.disposed) return;
      try {
        const cbc = browser.browsingContext;
        if (cbc && cbc.fullZoom !== zoom) cbc.fullZoom = zoom;
      } catch (e) { console.warn("[vivaldifox:look.uiZoom] popup zoom", e); }
      if (!tracked.has(browser)) {
        const observer = new win.MutationObserver(() => correct(browser));
        observer.observe(browser, { attributes: true, attributeFilter: ["style"] });
        // A remoteness change or docshell swap gives the browser a new browsing context.
        const onLoader = () => win.setTimeout(() => fit(browser), 0);
        browser.addEventListener("XULFrameLoaderCreated", onLoader);
        tracked.set(browser, { observer, onLoader, written: {} });
      }
      correct(browser);
    };
    const scan = root => {
      for (const b of (root || doc).querySelectorAll(POPUP_BROWSERS)) fit(b);
      // Forget popup browsers that have been removed.
      for (const [b, t] of tracked) if (!b.isConnected) { t.observer.disconnect(); tracked.delete(b); }
    };
    const onPopup = e => {
      scan(e.target);
      // The popup browser can be swapped into the panel right after it shows.
      win.setTimeout(() => scan(e.target), 0);
    };
    scope.listen(doc, "popupshowing", onPopup, true);
    scope.listen(doc, "popupshown", onPopup, true);
    scope.add(() => {
      for (const [b, t] of tracked) { t.observer.disconnect(); b.removeEventListener("XULFrameLoaderCreated", t.onLoader); }
      tracked.clear();
    });
    scan();
  },
};
