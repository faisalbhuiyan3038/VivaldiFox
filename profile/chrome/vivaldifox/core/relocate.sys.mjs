/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Moving Firefox's own toolbars below the page, and putting them back.
 *
 * Several independent features relocate a toolbar (tab bar at the bottom,
 * address bar at the bottom). Each must be undoable on its own, in any
 * order, so "remember my next sibling" is not good enough: that sibling may
 * itself have been moved or removed by another feature in the meantime.
 * Instead the toolbox's original child order is recorded once per window,
 * before any feature runs, and a node is always restored relative to that
 * recorded order.
 */
const original = new WeakMap(); // win -> string[] of toolbox child ids

/** Record the pristine toolbox order. Called by boot before features attach. */
export function captureLayout(win) {
  if (original.has(win)) return;
  const toolbox = win.document.getElementById("navigator-toolbox");
  if (toolbox) original.set(win, [...toolbox.children].map(c => c.id).filter(Boolean));
}

function move(parent, node, ref) {
  // moveBefore() relocates without disconnecting the subtree (no custom
  // element teardown, no lost focus); insertBefore() is the fallback.
  if (typeof parent.moveBefore === "function") {
    try { return parent.moveBefore(node, ref); } catch {}
  }
  parent.insertBefore(node, ref);
}

/**
 * Move a toolbox child directly below the page area for the lifetime of
 * `scope`. Vertical stacking among relocated bars is done with CSS `order`
 * by the features themselves, so DOM order below the page does not matter.
 */
export function moveBelowPage(scope, win, node) {
  const doc = win.document;
  const browser = doc.getElementById("browser"), toolbox = doc.getElementById("navigator-toolbox");
  if (!browser?.parentNode || !toolbox) throw new Error("#browser or #navigator-toolbox not found");
  captureLayout(win);
  move(browser.parentNode, node, browser.nextSibling);
  scope.add(() => {
    if (!toolbox.isConnected) return;
    const order = original.get(win) || [];
    const i = order.indexOf(node.id);
    // The first originally-later sibling that is still in the toolbox.
    let ref = null;
    for (const id of i >= 0 ? order.slice(i + 1) : []) {
      const el = doc.getElementById(id);
      if (el?.parentNode === toolbox) { ref = el; break; }
    }
    // Unknown node: put it first rather than after the bookmarks toolbar.
    if (i < 0) ref = toolbox.firstElementChild;
    move(toolbox, node, ref);
  });
}
