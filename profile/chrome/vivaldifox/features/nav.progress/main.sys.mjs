/* MPL-2.0. A4: page-load progress painted inside the address field. */
export default {
  window(win, scope) {
    const gB = win.gBrowser, urlbar = win.document.getElementById("urlbar");
    if (!urlbar) return;
    /** browser -> fraction 0..1 while loading */
    const progress = new WeakMap();
    let hideTimer = 0;

    const paint = () => {
      const p = progress.get(gB.selectedBrowser);
      win.clearTimeout(hideTimer);
      if (p == null) {
        urlbar.removeAttribute("vfx-loading");
        urlbar.style.removeProperty("--vfx-progress");
        return;
      }
      urlbar.setAttribute("vfx-loading", p >= 1 ? "done" : "true");
      urlbar.style.setProperty("--vfx-progress", `${Math.round(p * 100)}%`);
    };
    const finish = browser => {
      progress.set(browser, 1);
      if (browser === gB.selectedBrowser) paint();
      hideTimer = win.setTimeout(() => {
        progress.delete(browser);
        if (browser === gB.selectedBrowser) paint();
      }, 400);
    };

    const F = Ci.nsIWebProgressListener;
    const listener = {
      onStateChange(browser, wp, _req, flags) {
        if (!wp.isTopLevel || !(flags & F.STATE_IS_NETWORK)) return;
        if (flags & F.STATE_START) {
          progress.set(browser, 0.08);
          if (browser === gB.selectedBrowser) paint();
        } else if (flags & F.STATE_STOP) {
          finish(browser);
        }
      },
      onProgressChange(browser, _wp, _req, _cs, _ms, cur, max) {
        if (!progress.has(browser) || max <= 0) return;
        // Never move backwards, never reach 100% before STATE_STOP.
        const p = Math.max(progress.get(browser), Math.min(0.95, cur / max));
        progress.set(browser, p);
        if (browser === gB.selectedBrowser) paint();
      },
    };
    gB.addTabsProgressListener(listener);
    scope.add(() => {
      try { gB.removeTabsProgressListener(listener); } catch {}
      win.clearTimeout(hideTimer);
      urlbar.removeAttribute("vfx-loading");
      urlbar.style.removeProperty("--vfx-progress");
    });
    scope.listen(gB.tabContainer, "TabSelect", paint);
  },
};
