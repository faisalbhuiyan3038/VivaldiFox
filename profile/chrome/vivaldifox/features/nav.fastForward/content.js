/* MPL-2.0. Frame script for nav.fastForward: find the "next page" link. */
/* global content, addMessageListener, removeMessageListener, sendAsyncMessage */
(function () {
  const NEXT_TEXT = /^\s*(next|next page|more|older( posts| entries)?|weiter|suivant|siguiente|→|›|»|>>|>)\s*[→›»>]*\s*$/i;

  function findNext() {
    const doc = content?.document;
    if (!doc) return null;
    const ok = el => {
      try {
        const u = new URL(el.href, doc.baseURI);
        return /^(https?|file|data):$/.test(u.protocol) ? u.href : null;
      } catch { return null; }
    };
    // 1. Explicit semantics: <link rel=next>, <a rel=next>.
    for (const el of doc.querySelectorAll('link[rel~="next" i][href], a[rel~="next" i][href], area[rel~="next" i][href]')) {
      const href = ok(el);
      if (href) return { href, how: "rel=next" };
    }
    // 2. Link text / aria-label that reads like "Next".
    for (const a of doc.querySelectorAll("a[href]")) {
      const label = a.getAttribute("aria-label") || a.title || a.textContent || "";
      if (label.length < 30 && NEXT_TEXT.test(label)) {
        const href = ok(a);
        if (href && href !== doc.documentURI) return { href, how: "link text" };
      }
    }
    return null;
  }

  const onFind = msg => {
    let result = null;
    try { result = findNext(); } catch {}
    sendAsyncMessage("vfx:ff:findNext:reply", { id: msg.data.id, result });
  };
  const onUnload = () => {
    removeMessageListener("vfx:ff:findNext", onFind);
    removeMessageListener("vfx:nav.fastForward:unload", onUnload);
  };
  addMessageListener("vfx:ff:findNext", onFind);
  addMessageListener("vfx:nav.fastForward:unload", onUnload);
})();
