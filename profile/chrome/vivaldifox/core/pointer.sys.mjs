/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/** Pointer helpers shared by mouse gestures and rocker gestures. */

/**
 * Returns a function `block(ms)` that suppresses the context menu in `win`
 * for the next `ms` milliseconds. Both paths are covered: the chrome
 * `contextmenu` event, and the content-area menu that Firefox opens on behalf
 * of a web page (its popupshowing is cancelled).
 */
export function contextMenuBlocker(scope, win) {
  let until = 0;
  const active = () => Date.now() < until;
  scope.listen(win, "contextmenu", e => {
    if (active()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  const menu = win.document.getElementById("contentAreaContextMenu");
  scope.listen(menu, "popupshowing", e => {
    if (active() && e.target === menu) e.preventDefault();
  }, true);
  return (ms = 600) => { until = Date.now() + ms; };
}

/** True if the event happened over web content (not toolbars, menus or panels). */
export function overContent(e) {
  const t = e.target;
  return !!t?.closest?.("#tabbrowser-tabbox, #tabbrowser-tabpanels, browser");
}
