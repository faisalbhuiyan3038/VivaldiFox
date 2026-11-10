/* MPL-2.0. Notes data model (shared by the panel UI and optional bridges). */
import { Store } from "../../core/store.sys.mjs";

const DOC = "notes";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function data() {
  const d = await Store.load(DOC, { notes: [] });
  if (!Array.isArray(d.notes)) d.notes = [];
  return d;
}

export const Notes = {
  async all() {
    return (await data()).notes;
  },
  /** note: { title?, text, url?, image? } */
  async add(note) {
    const d = await data();
    const now = Date.now();
    const n = { id: uid(), title: note.title || "", text: note.text || "", url: note.url || "", image: note.image || "", created: now, modified: now };
    d.notes.unshift(n);
    Store.save(DOC);
    return n;
  },
  async update(id, patch) {
    const d = await data();
    const n = d.notes.find(x => x.id === id);
    if (!n) return null;
    Object.assign(n, patch, { modified: Date.now() });
    Store.save(DOC);
    return n;
  },
  async remove(id) {
    const d = await data();
    const i = d.notes.findIndex(x => x.id === id);
    if (i >= 0) d.notes.splice(i, 1);
    Store.save(DOC);
  },
  onChange: fn => Store.onChange(DOC, fn),
};

/** First non-empty line, used as the list title when a note has no title. */
export function titleOf(note) {
  if (note.title) return note.title;
  const line = (note.text || "").split("\n").find(l => l.trim());
  return line ? line.replace(/^#+\s*/, "").trim().slice(0, 80) : "Untitled note";
}

/**
 * Minimal, safe Markdown renderer: builds DOM nodes (never innerHTML), so
 * note content can never inject markup into the browser chrome.
 * Supports headings, bullet/numbered lists, fenced code, bold, italic,
 * inline code and links.
 */
export function renderMarkdown(doc, text, onLink) {
  const el = (tag, cls) => {
    const n = doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
    if (cls) n.className = cls;
    return n;
  };
  const inline = (parent, s) => {
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>]+))/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parent.append(s.slice(last, m.index));
      let node;
      if (m[2]) { node = el("strong"); node.textContent = m[2]; }
      else if (m[3]) { node = el("em"); node.textContent = m[3]; }
      else if (m[4]) { node = el("code"); node.textContent = m[4]; }
      else {
        const href = m[6] || m[7];
        node = el("a", "vfx-note-link");
        node.textContent = m[5] || href;
        if (/^https?:\/\//i.test(href)) {
          node.setAttribute("title", href);
          node.addEventListener("click", e => { e.preventDefault(); onLink?.(href); });
        }
      }
      parent.append(node);
      last = re.lastIndex;
    }
    if (last < s.length) parent.append(s.slice(last));
  };
  const out = el("div", "vfx-note-md");
  const lines = String(text || "").split("\n");
  let list = null, code = null;
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (code) { out.append(code); code = null; } else { code = el("pre"); }
      list = null;
      continue;
    }
    if (code) { code.append(line + "\n"); continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      const hN = el("h" + (m[1].length + 1));
      inline(hN, m[2]);
      out.append(hN);
      list = null;
    } else if ((m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line))) {
      const ordered = /\d/.test(m[1]);
      if (!list || (list.localName === "ol") !== ordered) {
        list = el(ordered ? "ol" : "ul");
        out.append(list);
      }
      const li = el("li");
      inline(li, m[2]);
      list.append(li);
    } else if (line.trim()) {
      const p = el("p");
      inline(p, line);
      out.append(p);
      list = null;
    } else {
      list = null;
    }
  }
  if (code) out.append(code);
  return out;
}
