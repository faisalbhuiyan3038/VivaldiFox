/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/** A short, self-dismissing message at the bottom of a browser window. */
export function toast(win, text, ms = 2600) {
  try {
    const doc = win.document;
    doc.getElementById("vfx-toast")?.remove();
    const el = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    el.id = "vfx-toast";
    el.setAttribute("role", "status");
    el.textContent = text;
    doc.documentElement.append(el);
    win.setTimeout(() => el.remove(), ms);
  } catch (e) {
    console.error("[vivaldifox] toast", e);
  }
}
