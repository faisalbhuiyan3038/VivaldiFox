/* MPL-2.0. Frame script for input.spatialNav.
 *
 * Shift+Arrow moves focus geometrically. Candidates are scored by distance
 * along the travel axis plus a penalty for sideways offset, the same idea as
 * the W3C CSS Spatial Navigation draft, kept deliberately small. It is a
 * heuristic: unusual layouts (overlapping or off-screen elements) can pick a
 * target the eye would not.
 */
/* global content, addEventListener, removeEventListener, addMessageListener, removeMessageListener, Services */
(function () {
  const SELECTOR = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="tab"], [role="menuitem"], [contenteditable=""], [contenteditable="true"]';
  const DIRS = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" };

  const isEditable = el => {
    if (!el) return false;
    const n = el.localName;
    if (n === "textarea" || n === "select" || el.isContentEditable) return true;
    return n === "input" && !/^(button|submit|reset|checkbox|radio|image|file|color|range)$/i.test(el.type);
  };

  function visibleRect(el, win) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const cs = win.getComputedStyle(el);
    if (cs.visibility !== "visible" || cs.display === "none" || cs.pointerEvents === "none") return null;
    if (el.disabled) return null;
    return r;
  }

  function pick(doc, win, dir) {
    const active = doc.activeElement && doc.activeElement !== doc.body && doc.activeElement !== doc.documentElement ? doc.activeElement : null;
    let from = active && visibleRect(active, win);
    if (!from) {
      // Nothing focused: start from the edge opposite to the travel direction.
      const w = win.innerWidth, h = win.innerHeight;
      from = dir === "D" ? new win.DOMRect(0, -1, w, 1) : dir === "U" ? new win.DOMRect(0, h, w, 1) : dir === "R" ? new win.DOMRect(-1, 0, 1, h) : new win.DOMRect(w, 0, 1, h);
    }
    const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
    let best = null, bestScore = Infinity;
    const vh = win.innerHeight, vw = win.innerWidth;
    for (const el of doc.querySelectorAll(SELECTOR)) {
      if (el === active) continue;
      const r = visibleRect(el, win);
      if (!r) continue;
      // Keep the search local: at most one screen beyond the viewport.
      if (r.bottom < -vh || r.top > vh * 2 || r.right < -vw || r.left > vw * 2) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let main, cross;
      if (dir === "R") { if (cx <= fx) continue; main = Math.max(0, r.left - from.right); cross = overlapGap(from.top, from.bottom, r.top, r.bottom); }
      else if (dir === "L") { if (cx >= fx) continue; main = Math.max(0, from.left - r.right); cross = overlapGap(from.top, from.bottom, r.top, r.bottom); }
      else if (dir === "D") { if (cy <= fy) continue; main = Math.max(0, r.top - from.bottom); cross = overlapGap(from.left, from.right, r.left, r.right); }
      else { if (cy >= fy) continue; main = Math.max(0, from.top - r.bottom); cross = overlapGap(from.left, from.right, r.left, r.right); }
      // Elements that do not overlap on the cross axis are heavily penalised.
      const score = main + cross * 3 + (cross > 0 ? 40 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  /** 0 when the two ranges overlap, otherwise the gap between them. */
  function overlapGap(a1, a2, b1, b2) {
    if (b2 < a1) return a1 - b2;
    if (b1 > a2) return b1 - a2;
    return 0;
  }

  const onKey = e => {
    if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    const dir = DIRS[e.key];
    if (!dir) return;
    const doc = e.target?.ownerDocument || content.document;
    const win = doc.defaultView;
    // Shift+Arrow extends the selection inside text fields: leave that alone.
    if (isEditable(doc.activeElement)) return;
    // ...and inside a page selection the user is extending with the keyboard.
    const sel = win.getSelection?.();
    if (sel && !sel.isCollapsed) return;
    const target = pick(doc, win, dir);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      // FLAG_BYKEY makes the page draw its normal keyboard focus ring.
      Services.focus.setFocus(target, Services.focus.FLAG_BYKEY);
    } catch {
      target.focus();
    }
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const onUnload = () => {
    removeEventListener("keydown", onKey, true);
    removeMessageListener("vfx:input.spatialNav:unload", onUnload);
  };
  addEventListener("keydown", onKey, true);
  addMessageListener("vfx:input.spatialNav:unload", onUnload);
})();
