/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Key engine: shared infrastructure for every feature that reacts to keys.
 *
 * Rather than rewriting Firefox's <key> elements (whose ids change between
 * releases), features install a capturing keydown listener on the window and
 * map a normalized combo string to a command id. Unmatched keys are left
 * completely untouched, so Firefox's own shortcuts keep working.
 *
 * Combo format: modifiers in the fixed order Ctrl+Alt+Shift+Meta, then the
 * key: "Ctrl+Shift+Y", "F2", "Alt+ArrowLeft", "Z", "1".
 */

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "OS", "AltGraph", "CapsLock", "NumLock", "Dead", "Process", "Unidentified"]);

/** Normalized combo for a keydown event, or null for bare modifier presses. */
export function comboOf(e) {
  if (MODIFIER_KEYS.has(e.key)) return null;
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

/** Canonicalize a user-written combo ("shift+ctrl+y" -> "Ctrl+Shift+Y"). */
export function normalizeCombo(str) {
  const parts = String(str).split("+").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return "";
  let key = parts.pop();
  if (str.trim().endsWith("++") || str.trim() === "+") key = "+";
  const mods = new Set(parts.map(p => p.toLowerCase()));
  if (key.length === 1) key = key.toUpperCase();
  else if (/^space$/i.test(key)) key = "Space";
  else if (/^f\d{1,2}$/i.test(key)) key = key.toUpperCase();
  else if (/^(esc|escape)$/i.test(key)) key = "Escape";
  else key = key[0].toUpperCase() + key.slice(1);
  const out = [];
  if (mods.has("ctrl") || mods.has("control")) out.push("Ctrl");
  if (mods.has("alt")) out.push("Alt");
  if (mods.has("shift")) out.push("Shift");
  if (mods.has("meta") || mods.has("cmd") || mods.has("win")) out.push("Meta");
  out.push(key);
  return out.join("+");
}

/**
 * True when the keyboard focus is in something the user types into: a chrome
 * text field, or (through the widget's IME state, which also reflects remote
 * web content) an editable element inside a page.
 */
export function isTyping(win) {
  try {
    const u = win.windowUtils;
    if (u.IMEStatus !== u.IME_STATUS_DISABLED) return true;
  } catch {}
  const a = win.document.activeElement;
  if (!a) return false;
  const name = a.localName;
  return name === "input" || name === "textarea" || name === "search-textbox" || a.isContentEditable || !!a.closest?.("#urlbar, findbar, panel, menupopup");
}

/**
 * Install a combo -> command-id map on a window.
 * @param {Scope} scope
 * @param {Window} win
 * @param {object} o
 * @param {() => Record<string,string>} o.map   returns the current map (already normalized)
 * @param {(id:string, win:Window) => boolean} o.run  returns true if the command ran
 * @param {(e:KeyboardEvent, combo:string) => boolean} [o.when]  extra guard
 */
export function installKeymap(scope, win, { map, run, when }) {
  scope.listen(win, "keydown", e => {
    if (e.defaultPrevented || e.isComposing) return;
    const combo = comboOf(e);
    if (!combo) return;
    const id = map()[combo];
    if (!id) return;
    if (when && !when(e, combo)) return;
    // Only swallow the key when the command really exists and ran.
    if (run(id, win)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}

/** Normalize the keys of a user-supplied {combo: commandId} object. */
export function normalizeMap(obj) {
  const out = {};
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const c = normalizeCombo(k);
      if (c && typeof v === "string" && v) out[c] = v;
    }
  }
  return out;
}
