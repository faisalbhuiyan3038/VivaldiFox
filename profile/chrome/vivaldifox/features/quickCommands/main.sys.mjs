/* MPL-2.0. I3: Quick Commands. A keyboard palette (default F2) searching, as
 * in Vivaldi:
 *   commands (with their keyboard shortcut), open tabs in every window and
 *   every workspace, recently closed tabs, bookmarks, history, search engines
 *   by keyword ("w quokka" searches the engine whose keyword is "w"),
 *   Firefox settings pages, workspaces, VivaldiFox features (turn on / off),
 *   and a calculator ("12*7+3", "sqrt(2)", "=2^10"; Enter copies the result).
 * Shift+Delete on a tab result closes that tab.
 * Self-contained: it builds its own overlay and does not hook the address bar. */
import { h, icon } from "../../core/ui.sys.mjs";
import { comboOf, normalizeCombo } from "../../core/keys.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { FEATURES } from "../../features.sys.mjs";

const OPTIONS_URL = "chrome://vivaldifox/content/options/options.html";
const SYS = () => Services.scriptSecurityManager.getSystemPrincipal();

/** Subsequence fuzzy score; higher is better, 0 = no match. */
export function fuzzy(query, text) {
  if (!query) return 1;
  const q = query.toLowerCase(), t = (text || "").toLowerCase();
  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 - idx - (t.length - q.length) * 0.1;
  let ti = 0, score = 0, streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - ti);
    ti = found + 1;
  }
  return Math.max(1, score);
}

// ───────────────────────────── Calculator ─────────────────────────────
const FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, exp: Math.exp,
  ln: Math.log, log: Math.log10, log2: Math.log2, round: Math.round, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };

/**
 * Evaluate an arithmetic expression without eval(): + - * / % ^, parentheses,
 * the functions above and pi / e / tau. Returns a finite number or null.
 * Plain numbers and words are not "calculations" unless forced with "=".
 */
export function calc(input) {
  let src = String(input).trim();
  const forced = src.startsWith("=");
  if (forced) src = src.slice(1);
  src = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/\*\*/g, "^").toLowerCase();
  if (!src || src.length > 200 || !/^[\d\s.+\-*/%^()a-z0-9]+$/.test(src)) return null;
  if (!forced && !/[+\-*/%^(]/.test(src.replace(/^\s*[-+]/, ""))) return null;
  const toks = src.match(/\d*\.?\d+(?:e[-+]?\d+)?|[a-z][a-z0-9]*|[-+*/%^()]|\S/g) || [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const fail = () => { throw new Error("calc"); };
  const primary = () => {
    const t = next();
    if (t === undefined) fail();
    if (t === "(") { const v = expr(); if (next() !== ")") fail(); return v; }
    if (/^\d|^\./.test(t)) return parseFloat(t);
    if (t in FUNCS) {
      if (next() !== "(") fail();
      const v = expr();
      if (next() !== ")") fail();
      return FUNCS[t](v);
    }
    if (t in CONSTS) return CONSTS[t];
    return fail();
  };
  const unary = () => {
    if (peek() === "-") { next(); return -unary(); }
    if (peek() === "+") { next(); return unary(); }
    return primary();
  };
  const power = () => {
    const b = unary();
    if (peek() === "^") { next(); return b ** power(); }
    return b;
  };
  const term = () => {
    let v = power();
    while (["*", "/", "%"].includes(peek())) {
      const op = next(), r = power();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + term() : v - term();
    return v;
  }
  try {
    const v = expr();
    if (i !== toks.length || !Number.isFinite(v)) return null;
    return Number(v.toPrecision(12));
  } catch {
    return null;
  }
}

// ───────────────────────────── Sources ─────────────────────────────
async function placesResults(query, limit) {
  const out = [];
  if (query.length < 2) return out;
  try {
    const PU = Fx.PlacesUtils;
    const seen = new Set();
    for (const b of await PU.bookmarks.search({ query })) {
      if (!b.url || seen.has(b.url.href)) continue;
      seen.add(b.url.href);
      out.push({ kind: "Bookmark", label: b.title || b.url.href, sub: b.url.href, url: b.url.href, icon: `page-icon:${b.url.href}`, score: 500 });
      if (out.length >= limit) break;
    }
    const db = await PU.promiseDBConnection();
    const like = "%" + query.replace(/[%_\\]/g, "\\$&") + "%";
    const rows = await db.executeCached(
      "SELECT url, title FROM moz_places WHERE hidden = 0 AND last_visit_date NOT NULL AND (title LIKE :q ESCAPE '\\' OR url LIKE :q ESCAPE '\\') ORDER BY frecency DESC LIMIT :n",
      { q: like, n: limit * 2 });
    let n = 0;
    for (const r of rows) {
      const url = r.getResultByName("url");
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ kind: "History", label: r.getResultByName("title") || url, sub: url, url, icon: `page-icon:${url}`, score: 300 });
      if (++n >= limit) break;
    }
  } catch (e) {
    console.warn("[vivaldifox:quickCommands] places lookup failed", e);
  }
  return out;
}

/** Visible search engines with their keywords, loaded once per palette. */
async function loadEngines() {
  try {
    // Services.search was removed in Firefox 160; the module export replaces it.
    const svc = Services.search || Fx.SearchService;
    const engines = await svc.getVisibleEngines();
    return engines.map(e => ({
      engine: e, name: e.name,
      aliases: [...new Set([...(e.aliases || []), e.alias].filter(Boolean).map(a => a.toLowerCase()))],
    }));
  } catch (e) {
    console.warn("[vivaldifox:quickCommands] search engines", e);
    return [];
  }
}

function searchWith(win, engine, terms) {
  const sub = engine.getSubmission(terms);
  win.openTrustedLinkIn(sub.uri.spec, "tab", { postData: sub.postData, triggeringPrincipal: SYS() });
}

function engineResults(win, engines, query) {
  const out = [];
  if (!query) return out;
  const sp = query.indexOf(" ");
  if (sp > 0) {
    // "keyword terms" -> search that engine directly.
    const kw = query.slice(0, sp).toLowerCase(), terms = query.slice(sp + 1).trim();
    const hit = engines.find(e => e.aliases.includes(kw));
    if (hit && terms) out.push({ kind: "Search", label: `Search ${hit.name} for “${terms}”`, sub: kw, score: 5000, run: () => searchWith(win, hit.engine, terms) });
  }
  // Typing an engine's name offers to start a search with it.
  for (const e of engines) {
    const s = fuzzy(query, e.name);
    if (s >= 900) {
      const kw = e.aliases[0];
      out.push({ kind: "Search", label: `Search with ${e.name}…`, sub: kw || "", score: s - 600, fill: kw ? kw + " " : null, run: kw ? null : () => searchWith(win, e.engine, "") });
    }
  }
  return out;
}

const SETTINGS = [
  ["General", "paneGeneral"], ["Home", "paneHome"], ["Search", "paneSearch"],
  ["Privacy & Security", "panePrivacy"], ["Cookies and Site Data", "privacy-sitedata"], ["Sync", "paneSync"],
];

function staticResults(win, ctx, query) {
  const out = [];
  if (!query) return out;
  for (const [label, pane] of SETTINGS) {
    const s = fuzzy(query, `Settings ${label}`);
    if (s) out.push({ kind: "Settings", label: `Settings: ${label}`, sub: pane, score: s, run: () => win.openPreferences(pane) });
  }
  const vs = fuzzy(query, "VivaldiFox settings");
  if (vs) out.push({ kind: "Settings", label: "VivaldiFox settings", sub: OPTIONS_URL, score: vs + 40, run: () => win.switchToTabHavingURI(OPTIONS_URL, true, { triggeringPrincipal: SYS() }) });
  // Feature toggles, e.g. "gestures" -> "Turn off: Mouse gestures".
  for (const def of FEATURES) {
    const s = Math.max(fuzzy(query, def.title), fuzzy(query, def.id) * 0.9);
    if (s < 500) continue; // substring matches only: loose subsequences flood the list
    const pref = `vivaldifox.${def.id}.enabled`;
    const on = Services.prefs.getBoolPref(pref, false);
    out.push({ kind: "VivaldiFox", label: `${on ? "Turn off" : "Turn on"}: ${def.title}`, sub: def.id, score: s * 0.8, run: () => Services.prefs.setBoolPref(pref, !on) });
  }
  // Workspaces.
  const ws = win.vfxWorkspaces;
  if (ws) {
    for (const w of ws.list()) {
      const s = Math.max(fuzzy(query, w.name), fuzzy(query, `workspace ${w.name}`) * 0.9);
      if (s && w.id !== ws.active()) out.push({ kind: "Workspace", label: `Switch to workspace: ${w.name}`, sub: "", score: s + 60, run: () => ws.switchTo(w.id) });
    }
  }
  // Recently closed tabs.
  try {
    const closed = Fx.SessionStore.getClosedTabDataForWindow(win) || [];
    closed.slice(0, 25).forEach((c, idx) => {
      const entries = c.state?.entries || [];
      const url = (entries[(c.state?.index || entries.length) - 1] || entries.at(-1))?.url || "";
      const s = Math.max(fuzzy(query, c.title), fuzzy(query, url) * 0.8);
      if (s) out.push({ kind: "Closed tab", label: c.title || url, sub: url, icon: c.image || null, score: s * 0.7, run: () => Fx.SessionStore.undoCloseTab(win, idx) });
    });
  } catch (e) { console.warn("[vivaldifox:quickCommands] closed tabs", e); }
  // Calculator.
  const v = calc(query);
  if (v !== null) {
    out.push({ kind: "Calculator", label: `= ${v.toLocaleString(undefined, { maximumFractionDigits: 12 })}`, sub: "Enter copies the result", score: 6000, run: () => {
      Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(String(v));
      toast(win, `Copied ${v}`);
    } });
  }
  return out;
}

/** command id -> shortcut text, from the features that bind keys. */
function shortcutHints(ctx) {
  const map = new Map();
  const add = (combo, id) => { if (combo && id && id !== "none" && !map.has(id)) map.set(id, combo); };
  try {
    if (ctx.isRunning("input.shortcuts")) {
      for (const [combo, id] of Object.entries(JSON.parse(Services.prefs.getStringPref("vivaldifox.input.shortcuts.map", "{}")))) add(combo, id);
    }
    if (ctx.isRunning("input.singleKey")) {
      for (const [key, id] of Object.entries(JSON.parse(Services.prefs.getStringPref("vivaldifox.input.singleKey.map", "{}")))) add(key, id);
    }
    if (ctx.isRunning("look.autohide")) add(Services.prefs.getStringPref("vivaldifox.look.autohide.key", ""), "look.toggleUI");
  } catch {}
  add(ctx.opt("key"), "quickCommands.open");
  return map;
}

function localResults(win, ctx, query, hints) {
  const out = [];
  for (const c of ctx.Commands.list(win)) {
    if (c.id === "none") continue;
    const s = Math.max(fuzzy(query, c.label), query.length > 2 ? fuzzy(query, c.id) * 0.7 : 0);
    if (s) out.push({ kind: c.group === "Firefox" ? "Command" : c.group, label: c.label, sub: c.id, key: hints.get(c.id), score: s + 50, run: () => ctx.Commands.run(c.id, win) });
  }
  const ws = win.vfxWorkspaces;
  const wsName = tab => ws?.list().find(w => w.id === ws.wsOf(tab))?.name;
  for (const w of Services.wm.getEnumerator("navigator:browser")) {
    if (w.closed || !w.gBrowser) continue;
    const here = w === win;
    for (const tab of w.gBrowser.tabs) {
      if (tab.closing) continue;
      // Hidden tabs are searched only when they are in another workspace.
      const other = here && tab.hidden ? wsName(tab) : null;
      if (tab.hidden && !(here && ws && other)) continue;
      const url = tab.linkedBrowser?.currentURI?.spec || "";
      let s = Math.max(fuzzy(query, tab.label), query ? fuzzy(query, url) * 0.8 : 0);
      if (!s) continue;
      if (!here || other) {
        if (!query) continue; // the empty palette lists this window's visible tabs only
        s *= 0.9;
      }
      out.push({
        kind: "Tab", label: tab.label, sub: other ? `in workspace “${other}” · ${url}` : here ? url : `other window · ${url}`,
        icon: w.gBrowser.getIcon(tab) || null, score: s + (query ? 80 : 0),
        run: () => { w.gBrowser.selectedTab = tab; if (!here) w.focus(); },
        close: () => w.gBrowser.removeTab(tab),
      });
    }
  }
  return out;
}

// ───────────────────────────── Palette ─────────────────────────────
function open(win, ctx) {
  const doc = win.document;
  if (doc.getElementById("vfx-qc")) return close(win);
  const input = h(doc, "html:input", { id: "vfx-qc-input", type: "text", placeholder: "Commands, tabs, bookmarks, history, settings, “keyword search”, 2+2…", autocomplete: "off", spellcheck: "false", "aria-label": "Quick Commands" });
  const list = h(doc, "html:div", { id: "vfx-qc-list", role: "listbox" });
  const hint = h(doc, "html:div", { id: "vfx-qc-hint", text: "↑↓ select · Enter run · Shift+Del close tab · Esc dismiss" });
  const box = h(doc, "html:div", { id: "vfx-qc", role: "dialog", "aria-label": "Quick Commands" }, [input, list, hint]);
  let items = [], sel = 0, token = 0;
  const hints = shortcutHints(ctx);
  const enginesP = loadEngines();

  const render = () => {
    list.replaceChildren(...items.map((it, i) => {
      const img = it.icon ? h(doc, "html:img", { class: "vfx-qc-icon", src: it.icon, alt: "" }) : h(doc, "html:span", { class: "vfx-qc-icon" });
      if (it.icon) img.addEventListener("error", () => img.replaceWith(h(doc, "html:span", { class: "vfx-qc-icon" })));
      const row = h(doc, "html:div", { class: "vfx-qc-row", role: "option", "aria-selected": i === sel ? "true" : "false" }, [
        h(doc, "html:span", { class: "vfx-qc-kind", text: it.kind }),
        img,
        h(doc, "html:span", { class: "vfx-qc-label", text: it.label }),
        h(doc, "html:span", { class: "vfx-qc-sub", text: it.sub || "" }),
        it.key ? h(doc, "html:kbd", { class: "vfx-qc-key", text: it.key }) : null,
      ]);
      row.addEventListener("mousedown", e => { e.preventDefault(); exec(i); });
      return row;
    }));
    list.children[sel]?.scrollIntoView({ block: "nearest" });
  };
  const exec = i => {
    const it = items[i];
    if (it?.fill) {
      // e.g. "Search with Wikipedia…": put its keyword in the field and keep going.
      input.value = it.fill;
      update();
      return;
    }
    close(win);
    if (!it) return;
    try {
      if (it.run) it.run();
      else if (it.url) win.openTrustedLinkIn(it.url, "tab");
    } catch (e) { console.error("[vivaldifox:quickCommands]", e); }
  };
  const update = async () => {
    const q = input.value.trim(), my = ++token;
    const max = ctx.opt("maxResults");
    let res = localResults(win, ctx, q, hints).concat(staticResults(win, ctx, q)).sort((a, b) => b.score - a.score).slice(0, max);
    items = res;
    sel = 0;
    render();
    if (q) {
      const [places, engines] = await Promise.all([placesResults(q, 6), enginesP]);
      if (my !== token || !box.isConnected) return; // a newer query superseded this one
      const searches = engineResults(win, engines, q);
      res = res.concat(searches, places).sort((a, b) => b.score - a.score);
      // Always offer the raw text as a search / address as the last entry.
      res.push({ kind: "Web", label: `Search or open “${q}”`, sub: "", run: () => win.openTrustedLinkIn(q, "tab", { allowThirdPartyFixup: true }) });
      items = res;
      render();
    }
  };

  input.addEventListener("input", update);
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || (e.key === "Tab" && !e.altKey)) {
      e.preventDefault();
      const down = e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey);
      if (items.length) sel = (sel + (down ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      if (items.length) sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === "PageDown" ? 8 : -8)));
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(sel);
    } else if (e.key === "Delete" && e.shiftKey && items[sel]?.close) {
      e.preventDefault();
      const it = items[sel];
      try { it.close(); } catch (err) { console.error(err); }
      win.setTimeout(update, 50);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(win);
    }
    e.stopPropagation();
  });
  input.addEventListener("blur", () => win.setTimeout(() => { if (doc.activeElement !== input) close(win); }, 120));
  doc.documentElement.append(box);
  input.focus();
  update();
  win.vfxQuickCommands.state = { get items() { return items; }, exec, input, update };
}

function close(win) {
  win.document.getElementById("vfx-qc")?.remove();
  if (win.vfxQuickCommands) win.vfxQuickCommands.state = null;
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "quickCommands.open", label: "Quick Commands", run: w => open(w, ctx) });
    ctx.widget(scope, { id: "vfx-quick-commands", label: "Quick Commands", tooltip: "Quick Commands", icon: icon("command"), area: null, onCommand: (_e, w) => open(w, ctx) });
  },
  window(win, scope, ctx) {
    const hotkey = normalizeCombo(ctx.opt("key"));
    scope.listen(win, "keydown", e => {
      if (hotkey && comboOf(e) === hotkey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        open(win, ctx);
      }
    }, true);
    win.vfxQuickCommands = { open: () => open(win, ctx), close: () => close(win), fuzzy, calc, state: null };
    scope.add(() => {
      close(win);
      delete win.vfxQuickCommands;
    });
  },
};
