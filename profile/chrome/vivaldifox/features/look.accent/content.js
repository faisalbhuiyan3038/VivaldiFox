/* MPL-2.0. Frame script for look.accent: report the page's theme-color. */
/* global content, addEventListener, removeEventListener, addMessageListener, removeMessageListener, sendAsyncMessage */
(function () {
  const report = () => {
    let color = "";
    try {
      const doc = content.document;
      const dark = content.matchMedia("(prefers-color-scheme: dark)").matches;
      let fallback = "";
      for (const m of doc.querySelectorAll('meta[name="theme-color" i]')) {
        const media = m.getAttribute("media");
        const value = (m.getAttribute("content") || "").trim();
        if (!value) continue;
        if (!media) fallback ||= value;
        else if (content.matchMedia(media).matches) { color = value; break; }
        else if (!fallback && !dark) fallback = value;
      }
      color ||= fallback;
    } catch {}
    sendAsyncMessage("vfx:accent:theme", { color });
  };
  const onEvent = e => {
    // Top-level document only.
    if (e.target === content.document || e.target?.defaultView === content) report();
  };
  const onUnload = () => {
    removeEventListener("DOMContentLoaded", onEvent, true);
    removeEventListener("pageshow", onEvent, true);
    removeMessageListener("vfx:look.accent:unload", onUnload);
  };
  addEventListener("DOMContentLoaded", onEvent, true);
  addEventListener("pageshow", onEvent, true);
  addMessageListener("vfx:look.accent:unload", onUnload);
  report();
})();
