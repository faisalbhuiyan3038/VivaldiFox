/* MPL-2.0. VivaldiFox settings page logic.
 * A thin view over about:config: every control reads/writes one
 * vivaldifox.* pref, and the loader reacts to the pref change. Nothing here
 * holds state of its own, so the page, about:config and user.js always agree. */
const { VivaldiFox } = ChromeUtils.importESModule("chrome://vivaldifox/content/boot.sys.mjs");
const P = Services.prefs;
const PREF = VivaldiFox.PREF;
const $ = s => document.querySelector(s);

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...[].concat(kids).filter(Boolean));
  return n;
}

function optionControl(def, key, o) {
  const name = `${PREF}${def.id}.${key}`;
  const id = `opt-${def.id}-${key}`.replace(/\./g, "-");
  const msg = el("div", { class: "msg", role: "alert" });
  let input;
  const cur = () => VivaldiFox.opt(def.id, key);
  if (o.type === "bool") {
    input = el("input", { type: "checkbox", id });
    input.checked = cur();
    input.addEventListener("change", () => VivaldiFox.setOpt(def.id, key, input.checked));
  } else if (o.type === "int") {
    input = el("input", { type: "number", id, step: "1" });
    input.value = cur();
    input.addEventListener("change", () => { if (/^-?\d+$/.test(input.value.trim())) VivaldiFox.setOpt(def.id, key, Number(input.value)); else input.value = cur(); });
  } else if (o.type === "enum") {
    input = el("select", { id }, o.values.map(v => el("option", { value: v, text: v })));
    input.value = cur();
    input.addEventListener("change", () => VivaldiFox.setOpt(def.id, key, input.value));
  } else if (o.type === "json") {
    input = el("textarea", { id, spellcheck: "false" });
    input.value = JSON.stringify(cur(), null, 2);
    input.addEventListener("change", () => {
      try {
        const v = JSON.parse(input.value);
        input.classList.remove("bad");
        msg.textContent = "";
        VivaldiFox.setOpt(def.id, key, v);
      } catch (e) {
        // Invalid JSON is never written: the running feature keeps its last good value.
        input.classList.add("bad");
        msg.textContent = `Not saved, invalid JSON: ${e.message}`;
      }
    });
  } else {
    input = el("input", { type: "text", id });
    input.value = cur();
    input.addEventListener("change", () => VivaldiFox.setOpt(def.id, key, input.value));
  }
  const reset = el("button", { type: "button", class: "reset", text: "Reset", title: `Reset ${name} to its default`, onclick: () => { P.clearUserPref(name); render(); } });
  const wide = o.type === "json";
  return el("div", { class: "opt" + (wide ? " wide" : "") }, [
    el("label", { for: id, text: o.label || key, title: name }),
    wide ? el("div", {}, [input, msg, P.prefHasUserValue(name) ? reset : null]) : el("div", { style: "display: flex; gap: 8px; align-items: center" }, [input, P.prefHasUserValue(name) ? reset : null]),
  ]);
}

function render() {
  const status = new Map(VivaldiFox.status().map(s => [s.id, s]));
  const filter = $("#filter").value.trim().toLowerCase();
  const main = $("#features");
  const frag = document.createDocumentFragment();
  let cat = null, shown = 0;
  for (const def of VivaldiFox.FEATURES) {
    if (filter && !`${def.id} ${def.title} ${def.desc} ${def.cat}`.toLowerCase().includes(filter)) continue;
    if (def.cat !== cat) {
      cat = def.cat;
      frag.append(el("h2", { text: cat }));
    }
    shown++;
    const st = status.get(def.id);
    const toggleId = `feature-${def.id}`.replace(/\./g, "-");
    const toggle = el("input", { type: "checkbox", id: toggleId, "data-feature": def.id });
    toggle.checked = st.enabled;
    toggle.addEventListener("change", () => {
      P.setBoolPref(`${PREF}${def.id}.enabled`, toggle.checked);
      // The loader reacts synchronously for most features; async ones need a tick.
      setTimeout(render, 150);
    });
    const card = el("div", { class: "feature", "data-id": def.id, "data-running": String(st.running), "data-error": String(!!st.error) }, [
      el("div", { class: "head" }, [
        toggle,
        el("label", { for: toggleId }, [el("div", { class: "title", text: def.title }), el("div", { class: "desc", text: def.desc })]),
        el("code", { class: "id", text: `${def.id}.enabled`, title: `${PREF}${def.id}.enabled` }),
      ]),
      st.error ? el("div", { class: "error", text: `This feature failed to start and was switched off for this session:\n${st.error}` }) : null,
      def.options ? el("div", { class: "opts" }, Object.entries(def.options).map(([k, o]) => optionControl(def, k, o))) : null,
    ]);
    frag.append(card);
  }
  main.replaceChildren(frag);
  const on = [...status.values()].filter(s => s.running).length;
  const failed = [...status.values()].filter(s => s.error).length;
  $("#summary").textContent = `${on} of ${status.size} features on` + (failed ? `, ${failed} failed` : "") + (filter ? ` — showing ${shown}` : "");
  $("#master").checked = P.getBoolPref(`${PREF}enabled`, true);
  $("#panel-side").value = P.getStringPref(`${PREF}panels.side`, "left");
  $("#panel-width").value = P.getIntPref(`${PREF}panels.width`, 340);
  $("#panel-autohide").checked = P.getBoolPref(`${PREF}panels.autohide`, false);
  $("#panel-hidden").checked = P.getBoolPref(`${PREF}panels.hidden`, false);
  const win = window.browsingContext.topChromeWindow;
  $("#commands").replaceChildren(...VivaldiFox.Commands.list(win).map(c => el("div", {}, [el("code", { text: c.id }), ` ${c.label}`])));
}

$("#master").addEventListener("change", e => { P.setBoolPref(`${PREF}enabled`, e.target.checked); setTimeout(render, 200); });
$("#filter").addEventListener("input", render);
$("#all-off").addEventListener("click", () => {
  for (const def of VivaldiFox.FEATURES) P.clearUserPref(`${PREF}${def.id}.enabled`);
  setTimeout(render, 200);
});
$("#panel-side").addEventListener("change", e => P.setStringPref(`${PREF}panels.side`, e.target.value));
$("#panel-autohide").addEventListener("change", e => P.setBoolPref(`${PREF}panels.autohide`, e.target.checked));
$("#panel-hidden").addEventListener("change", e => P.setBoolPref(`${PREF}panels.hidden`, e.target.checked));
$("#panel-width").addEventListener("change", e => { if (/^\d+$/.test(e.target.value)) P.setIntPref(`${PREF}panels.width`, Math.max(180, Math.min(Number(e.target.value), 1000))); });

// Stay in sync with about:config and other windows (re-render unless the user is typing).
let timer = 0;
const obs = { observe() {
  clearTimeout(timer);
  timer = setTimeout(() => { if (!document.activeElement?.matches("textarea, input[type=text], input[type=number], input[type=search]")) render(); }, 300);
} };
P.addObserver(PREF, obs);
window.addEventListener("unload", () => P.removeObserver(PREF, obs));

render();
window.vfxOptions = { render };
