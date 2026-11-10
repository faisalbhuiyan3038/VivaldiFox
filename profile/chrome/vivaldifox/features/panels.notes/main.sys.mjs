/* MPL-2.0. P2: Notes panel. Markdown notes stored in
 * <profile>/vivaldifox-data/notes.json, plus "add selection as note". */
import { h, icon, addToPopup, onPopupShowing } from "../../core/ui.sys.mjs";
import { Panels } from "../../core/panels.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { Notes, titleOf, renderMarkdown } from "./notes.sys.mjs";

const PANEL = "notes";

function build(node, win) {
  const doc = win.document;
  let notes = [], selected = null, preview = false, query = "", saveTimer = 0;

  const search = h(doc, "html:input", { class: "vfx-p-input", type: "search", placeholder: "Search notes", "aria-label": "Search notes" });
  const list = h(doc, "html:div", { class: "vfx-p-list vfx-notes-list" });
  const editor = h(doc, "html:textarea", { class: "vfx-notes-editor", placeholder: "Write a note… (Markdown supported)", spellcheck: "true", "aria-label": "Note text" });
  const view = h(doc, "html:div", { class: "vfx-notes-view", hidden: "true" });
  const meta = h(doc, "html:div", { class: "vfx-notes-meta" });
  const previewBtn = h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "Preview", tooltiptext: "Toggle Markdown preview", oncommand: () => { preview = !preview; showNote(); } });

  const flush = () => {
    win.clearTimeout(saveTimer);
    saveTimer = 0;
    if (selected && editor.value !== selected.text) return Notes.update(selected.id, { text: editor.value });
    return null;
  };
  const showNote = () => {
    const has = !!selected;
    editor.disabled = !has;
    previewBtn.toggleAttribute("checked", preview);
    editor.hidden = preview;
    view.hidden = !preview;
    if (!has) {
      editor.value = "";
      view.replaceChildren();
      meta.replaceChildren();
      return;
    }
    if (doc.activeElement !== editor) editor.value = selected.text;
    if (preview) {
      const md = renderMarkdown(doc, editor.value, href => win.openTrustedLinkIn(href, "tab"));
      if (selected.image) md.prepend(h(doc, "html:img", { class: "vfx-note-image", src: selected.image, alt: "Capture" }));
      view.replaceChildren(md);
    }
    meta.replaceChildren();
    if (selected.url) {
      const a = h(doc, "html:a", { class: "vfx-note-link", text: selected.url, title: selected.url });
      a.addEventListener("click", () => win.openTrustedLinkIn(selected.url, "tab"));
      meta.append(a);
    }
  };
  const renderList = () => {
    const q = query.toLowerCase();
    const shown = notes.filter(n => !q || (n.title + "\n" + n.text + "\n" + n.url).toLowerCase().includes(q));
    list.replaceChildren(...shown.map(n => {
      const row = h(doc, "html:div", { class: "vfx-p-row", "data-id": n.id, selected: selected?.id === n.id ? "true" : null }, [
        h(doc, "html:div", { class: "vfx-p-main" }, [
          h(doc, "html:span", { class: "vfx-p-title", text: titleOf(n) }),
          h(doc, "html:span", { class: "vfx-p-sub", text: new Date(n.modified).toLocaleString() }),
        ]),
      ]);
      row.addEventListener("click", async () => {
        await flush();
        selected = n;
        renderList();
        showNote();
      });
      return row;
    }));
    if (!shown.length) list.append(h(doc, "html:div", { class: "vfx-p-empty", text: notes.length ? "No matching notes." : "No notes yet." }));
  };
  const reload = async () => {
    notes = await Notes.all();
    if (selected) selected = notes.find(n => n.id === selected.id) || null;
    renderList();
    showNote();
  };

  editor.addEventListener("input", () => {
    win.clearTimeout(saveTimer);
    saveTimer = win.setTimeout(flush, 500);
  });
  editor.addEventListener("blur", flush);
  search.addEventListener("input", () => { query = search.value; renderList(); });

  node.append(
    h(doc, "hbox", { class: "vfx-p-toolbar" }, [
      search,
      h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "＋", tooltiptext: "New note", oncommand: async () => { await flush(); selected = await Notes.add({ text: "" }); preview = false; await reload(); editor.focus(); } }),
      h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label: "🗑", tooltiptext: "Delete note", oncommand: async () => { if (selected) { const id = selected.id; selected = null; await Notes.remove(id); await reload(); } } }),
      previewBtn,
    ]),
    list, meta, editor, view);

  const off = Notes.onChange(() => reload());
  reload();
  // Expose for automation and for the "add selection" flow to select the new note.
  node.vfxNotes = { reload, select: async id => { await reload(); selected = notes.find(n => n.id === id) || null; renderList(); showNote(); }, flush };
  return () => { off(); flush(); };
}

async function addSelection(win) {
  const cm = win.gContextMenu;
  const info = cm?.selectionInfo || {};
  const text = (info.fullText || info.text || cm?.selectedText || "").trim();
  if (!text) return null;
  const browser = win.gBrowser.selectedBrowser;
  const note = await Notes.add({ text, url: browser.currentURI.spec, title: "" });
  toast(win, "Selection added to Notes");
  return note;
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "panels.notes", label: "Toggle Notes panel", run: w => Panels.toggle(w, PANEL) });
    ctx.Commands.register(scope, {
      id: "notes.new", label: "New note",
      run: async w => { const n = await Notes.add({ text: "" }); Panels.open(w, PANEL); w.document.querySelector('.vfx-panel[data-panel="notes"]')?.vfxNotes?.select(n.id); },
    });
  },
  window(win, scope) {
    Panels.register(scope, win, { id: PANEL, title: "Notes", icon: icon("notes"), order: 10, build });
    const item = addToPopup(scope, win, "contentAreaContextMenu", h(win.document, "menuitem", {
      id: "vfx-note-selection", label: "Add Selection as Note", oncommand: () => addSelection(win),
    }), "context-searchselect");
    if (item) {
      onPopupShowing(scope, win, "contentAreaContextMenu", () => {
        const cm = win.gContextMenu;
        item.hidden = !(cm?.isTextSelected || cm?.selectionInfo?.text);
      });
    }
    win.vfxNotes = { Notes, addSelection: () => addSelection(win) };
    scope.add(() => delete win.vfxNotes);
  },
};
