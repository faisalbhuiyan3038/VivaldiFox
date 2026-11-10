/* MPL-2.0. Frame script for page.actions: apply the tab's CSS as a user sheet. */
/* global content, addMessageListener, removeMessageListener, sendAsyncMessage, addEventListener, removeEventListener */
(function () {
  /** CSS currently wanted for this tab ("" = none). */
  let css = "";
  /** window -> data: URI of the sheet loaded into it */
  const loaded = new WeakMap();

  function applyTo(win) {
    let utils;
    try { utils = win.windowUtils; } catch { return; }
    const old = loaded.get(win);
    if (old) {
      try { utils.removeSheetUsingURIString(old, utils.USER_SHEET); } catch {}
      loaded.delete(win);
    }
    if (!css) return;
    const uri = "data:text/css;charset=utf-8," + encodeURIComponent(css);
    try {
      utils.loadSheetUsingURIString(uri, utils.USER_SHEET);
      loaded.set(win, uri);
    } catch {}
  }

  function applyAll(win) {
    if (!win) return;
    applyTo(win);
    // Same-process subframes only; cross-site frames live in other processes.
    for (let i = 0; i < win.frames.length; i++) {
      try { applyAll(win.frames[i]); } catch {}
    }
  }

  const onApply = msg => {
    css = msg.data?.data || "";
    applyAll(content);
  };
  // A new document in this tab: re-apply as early as possible.
  const onNewDoc = e => {
    const win = e.target?.defaultView;
    if (win && css) applyTo(win);
  };
  const onUnload = () => {
    css = "";
    try { applyAll(content); } catch {}
    removeMessageListener("vfx:pa:apply", onApply);
    removeMessageListener("vfx:page.actions:unload", onUnload);
    removeEventListener("DOMDocElementInserted", onNewDoc, true);
  };
  addMessageListener("vfx:pa:apply", onApply);
  addMessageListener("vfx:page.actions:unload", onUnload);
  addEventListener("DOMDocElementInserted", onNewDoc, true);
  // A fresh process for this tab (cross-site navigation): ask for current state.
  sendAsyncMessage("vfx:pa:hello");
})();
