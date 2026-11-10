/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/** Small DOM helpers shared by features. No feature logic lives here. */

const XHTML = "http://www.w3.org/1999/xhtml";

export const icon = name => `chrome://vivaldifox/content/icons/${name}.svg`;

/**
 * Create an element. Tags are XUL unless prefixed "html:".
 * attrs: `text` sets textContent, `on<event>` adds a listener, null is skipped.
 */
export function h(doc, tag, attrs = {}, kids = []) {
  const el = tag.startsWith("html:") ? doc.createElementNS(XHTML, tag.slice(5)) : doc.createXULElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), (...a) => {
        try { return v(...a); } catch (e) { console.error("[vivaldifox]", e); }
      });
    } else el.setAttribute(k, v === true ? "true" : v);
  }
  for (const kid of [].concat(kids)) if (kid) el.append(kid);
  return el;
}

/**
 * Insert an item into an existing Firefox popup (by id) for the lifetime of
 * `scope`. If the popup does not exist in this Firefox version the call is a
 * silent no-op and returns null: a missing menu must never break a feature.
 * `before` is the id of a sibling to insert before (falls back to append).
 */
export function addToPopup(scope, win, popupId, el, before) {
  const popup = win.document.getElementById(popupId);
  if (!popup) return null;
  const ref = before && win.document.getElementById(before);
  if (ref && ref.parentNode === popup) popup.insertBefore(el, ref);
  else popup.appendChild(el);
  scope.node(el);
  return el;
}

/** Run fn each time the popup itself (not a submenu) is about to show. */
export function onPopupShowing(scope, win, popupId, fn) {
  const popup = typeof popupId === "string" ? win.document.getElementById(popupId) : popupId;
  if (!popup) return;
  scope.listen(popup, "popupshowing", e => { if (e.target === popup) fn(e, popup); });
}

/** The tab a tab-context-menu command applies to. */
export function contextTab(win) {
  return win.TabContextMenu?.contextTab || win.gBrowser.selectedTab;
}

/**
 * A toolbar button that opens a menupopup rebuilt on each open.
 * populate(popup, win) appends the items.
 */
export function menuWidget(ctx, scope, { populate, ...w }) {
  return ctx.widget(scope, {
    ...w,
    onCreated(node, win) {
      const doc = node.ownerDocument;
      node.setAttribute("type", "menu");
      node.setAttribute("wantdropmarker", "false");
      const popup = h(doc, "menupopup", { class: "vfx-widget-popup" });
      popup.addEventListener("popupshowing", e => {
        if (e.target !== popup) return;
        popup.replaceChildren();
        try { populate(popup, doc.defaultView); } catch (err) { console.error("[vivaldifox]", err); }
        if (!popup.childElementCount) popup.append(h(doc, "menuitem", { label: "(empty)", disabled: true }));
      });
      // Menu commands must not bubble into the widget's own onCommand.
      popup.addEventListener("command", e => e.stopPropagation());
      node.append(popup);
      w.onCreated?.(node, win);
    },
  });
}

/** Plain-text prompt. Returns null when cancelled. */
export function promptText(win, title, text, value = "") {
  const out = { value };
  return Services.prompt.prompt(win, title, text, out, null, {}) ? out.value : null;
}
