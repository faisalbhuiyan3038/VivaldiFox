/* MPL-2.0. I3: Quick Commands. A keyboard palette (default F2) searching
 * commands, open tabs, bookmarks and history. Self-contained: it builds its
 * own overlay and does not hook the address bar. */
import { h, icon } from "../../core/ui.sys.mjs";
import { comboOf, normalizeCombo } from "../../core/keys.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";

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

async function placesResults(query, limit) {
  const out = [];
  if (query.length < 2) return out;
  try {
    const PU = Fx.PlacesUtils;
    const seen = new Set();
    for (const b of await PU.bookmarks.search({ query })) {
      if (!b.url || seen.has(b.url.href)) continue;
      seen.add(b.url.href);
      out.push({ kind: "Bookmark", label: b.title || b.url.href, sub: b.url.href, url: b.url.href, score: 500 });
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
      out.push({ kind: "History", label: r.getResultByName("title") || url, sub: url, url, score: 300 });
      if (++n >= limit) break;
    }
  } catch (e) {
    console.warn("[vivaldifox:quickCommands] places lookup failed", e);
  }
  return out;
}

function localResults(win, ctx, query) {
  const out = [];
  for (const c of ctx.Commands.list(win)) {
    if (c.id === "none") continue;
    const s = fuzzy(query, c.label);
    if (s) out.push({ kind: c.group === "Firefox" ? "Command" : c.group, label: c.label, sub: c.id, score: s + 50, run: () => ctx.Commands.run(c.id, win) });
  }
  for (const tab of win.gBrowser.tabs) {
    if (tab.hidden || tab.closing) continue;
    const url = tab.linkedBrowser?.currentURI?.spec || "";
    const s = Math.max(fuzzy(query, tab.label), query ? fuzzy(query, url) * 0.8 : 0);
    if (s) out.push({ kind: "Tab", label: tab.label, sub: url, score: s + (query ? 80 : 0), run: () => { win.gBrowser.selectedTab = tab; } });
  }
  return out;
}

function open(win, ctx) {
  const doc = win.document;
  if (doc.getElementById("vfx-qc")) return close(win);
  const input = h(doc, "html:input", { id: "vfx-qc-input", type: "text", placeholder: "Search commands, tabs, bookmarks, history…", autocomplete: "off", spellcheck: "false", "aria-label": "Quick Commands" });
  const list = h(doc, "html:div", { id: "vfx-qc-list", role: "listbox" });
  const box = h(doc, "html:div", { id: "vfx-qc", role: "dialog", "aria-label": "Quick Commands" }, [input, list]);
  let items = [], sel = 0, token = 0;

  const render = () => {
    list.replaceChildren(...items.map((it, i) => {
      const row = h(doc, "html:div", { class: "vfx-qc-row", role: "option", "aria-selected": i === sel ? "true" : "false" }, [
        h(doc, "html:span", { class: "vfx-qc-kind", text: it.kind }),
        h(doc, "html:span", { class: "vfx-qc-label", text: it.label }),
        h(doc, "html:span", { class: "vfx-qc-sub", text: it.sub || "" }),
      ]);
      row.addEventListener("mousedown", e => { e.preventDefault(); exec(i); });
      return row;
    }));
    list.children[sel]?.scrollIntoView({ block: "nearest" });
  };
  const exec = i => {
    const it = items[i];
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
    let res = localResults(win, ctx, q).sort((a, b) => b.score - a.score).slice(0, max);
    items = res;
    sel = 0;
    render();
    if (q) {
      const places = await placesResults(q, 6);
      if (my !== token || !box.isConnected) return; // a newer query superseded this one
      res = res.concat(places);
      // Always offer the raw text as a search / address as the last entry.
      res.push({ kind: "Web", label: `Search or open “${q}”`, sub: "", run: () => win.openTrustedLinkIn(q, "tab", { allowThirdPartyFixup: true }) });
      items = res;
      render();
    }
  };

  input.addEventListener("input", update);
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(sel);
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
    win.vfxQuickCommands = { open: () => open(win, ctx), close: () => close(win), fuzzy, state: null };
    scope.add(() => {
      close(win);
      delete win.vfxQuickCommands;
    });
  },
};
