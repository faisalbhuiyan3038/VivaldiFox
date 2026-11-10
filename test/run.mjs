#!/usr/bin/env node
// Feature test runner. Requires a running test Firefox (`node test/fx.mjs start`).
//
//   node test/run.mjs               run every case in test/cases/
//   node test/run.mjs tabs.trash    run selected cases
//   node test/run.mjs --all-on      enable everything at once, then run all cases
//   node test/run.mjs --md out.md   also write a markdown report
//
// For each case the runner: enables ONLY that feature (independence check),
// verifies it reports running without error, runs the case body in the
// browser chrome context, disables it again, and checks that nothing was left
// behind (no vfx-* nodes or root attributes) and that nothing was logged to
// the error console by the mod.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { Marionette } from "./lib/marionette.mjs";

// Local web server so cases can exercise real http(s)-style pages:
//   /html?b=<html>   echoes the given markup
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(u.searchParams.get("b") || "<title>empty</title>");
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const HTTP = `http://127.0.0.1:${server.address().port}`;

const DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mdIdx = args.indexOf("--md");
const mdOut = mdIdx >= 0 ? args.splice(mdIdx, 2)[1] : null;
const allOn = args.includes("--all-on");
const only = args.filter(a => !a.startsWith("--"));

const PRELUDE = () => `
const resolve = arguments[arguments.length - 1];
const win = Services.wm.getMostRecentWindow("navigator:browser");
const doc = win.document, gBrowser = win.gBrowser;
const { VivaldiFox } = ChromeUtils.importESModule("chrome://vivaldifox/content/boot.sys.mjs");
const sleep = ms => new Promise(r => win.setTimeout(r, ms));
const assert = (c, m) => { if (!c) throw new Error("assert failed: " + m); };
const waitFor = async (fn, what = "condition", ms = 8000) => {
  const t0 = Date.now();
  for (;;) {
    let v; try { v = await fn(); } catch {}
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("timeout waiting for " + what);
    await sleep(50);
  }
};
const $ = s => doc.querySelector(s);
const openTab = async (url, opts = {}) => {
  const tab = gBrowser.addTab(url, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(), ...opts });
  await waitFor(() => !tab.hasAttribute("busy") && tab.linkedBrowser.currentURI.spec !== "about:blank" || url === "about:blank", "tab load " + url);
  return tab;
};
const page = html => "data:text/html;charset=utf-8," + encodeURIComponent(html);
const web = html => "${HTTP}/html?b=" + encodeURIComponent(html);
const st = id => VivaldiFox.status().find(s => s.id === id);
// Run code inside the tab's content process (frame script); resolves its return value.
const inContent = (tab, code) => new Promise(res => {
  const mm = tab.linkedBrowser.messageManager, n = "vfxtest:" + Math.random();
  const l = m => { mm.removeMessageListener(n, l); res(m.data); };
  mm.addMessageListener(n, l);
  const src = "(async()=>{let r;try{r=await(async()=>{" + code + "})()}catch(e){r='ERR '+e}sendAsyncMessage(" + JSON.stringify(n) + ",r)})()";
  mm.loadFrameScript("data:application/javascript;charset=utf-8," + encodeURIComponent(src), false);
});
const keydown = (target, key, mods = {}) => {
  const e = new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...mods });
  target.dispatchEvent(e);
  return e;
};
const mouse = (target, type, o) => target.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win, ...o }));
`;

const wrap = body => `${PRELUDE()}
(async () => { ${body} })().then(v => resolve({ ok: true, v }), e => resolve({ ok: false, err: String(e) + "\\n" + (e.stack || "") }));`;

const m = await Marionette.connect(2829);
await m.newSession();
await m.setContext("chrome");
const run = (body, a = []) => m.exec(wrap(body), a, { async: true, timeout: 60000 });

// Install an error collector once per browser session.
await run(`
if (!Services.vfxTestErrors) {
  const errs = Services.vfxTestErrors = [];
  Services.console.registerListener({ observe(msg) {
    try {
      if (msg instanceof Ci.nsIScriptError && !(msg.flags & Ci.nsIScriptError.warningFlag) && /vivaldifox/i.test(msg.sourceName + " " + msg.errorMessage))
        errs.push(msg.errorMessage + " @" + msg.sourceName + ":" + msg.lineNumber);
    } catch {}
  } });
  Services.obs.addObserver({ observe(s) {
    try {
      const e = s.wrappedJSObject;
      if (e.level === "error" && /vivaldifox/i.test(e.filename + " " + e.arguments.map(String).join(" ")))
        errs.push(e.arguments.map(a => (a && a.stack ? a + " " + a.stack.split("\\n")[0] : String(a))).join(" "));
    } catch {}
  } }, "console-api-log-event");
}
return true;`);

const info = (await run(`return { version: Services.appinfo.version, build: Services.appinfo.appBuildID, features: VivaldiFox.FEATURES.map(f => ({ id: f.id, options: Object.keys(f.options || {}) })) };`)).v;
const cases = fs.readdirSync(path.join(DIR, "cases")).filter(f => f.endsWith(".js")).map(f => f.slice(0, -3)).sort();
const known = new Set(info.features.map(f => f.id));
const results = [];

if (allOn) {
  await run(`for (const f of VivaldiFox.FEATURES) Services.prefs.setBoolPref("vivaldifox." + f.id + ".enabled", true); await sleep(1500); return 1;`);
}

for (const id of cases) {
  if (only.length && !only.includes(id)) continue;
  const src = fs.readFileSync(path.join(DIR, "cases", id + ".js"), "utf8");
  // Optional first-line header: // prefs: {"key": value}
  const hdr = /^\/\/ prefs: (.+)$/m.exec(src);
  const prefs = hdr ? JSON.parse(hdr[1]) : {};
  // "core.*" cases test the framework itself and enable nothing up front.
  const stripped = id.replace(/\.[^.]+$/, "");
  const feature = known.has(id) ? id : known.has(stripped) ? stripped : null;
  const r = { id, feature };
  try {
    const setup = await run(`
      const [id, prefs, allOn] = arguments;
      Services.vfxTestErrors.length = 0;
      if (id) {
        for (const [k, v] of Object.entries(prefs)) VivaldiFox.setOpt(id, k, v);
        if (!allOn) Services.prefs.setBoolPref("vivaldifox." + id + ".enabled", true);
      }
      await sleep(400);
      const others = VivaldiFox.status().filter(s => s.running && s.id !== id).map(s => s.id);
      return { status: id ? st(id) : { running: true }, others };`, [feature, prefs, allOn]);
    if (!setup.ok) throw new Error(setup.err);
    r.status = setup.v.status;
    if (!allOn && setup.v.others.length) throw new Error("other features running: " + setup.v.others);
    if (!r.status?.running || r.status.error) throw new Error("feature not running: " + (r.status?.error || "unknown"));
    const out = await run(src);
    r.ok = out.ok;
    r.detail = out.ok ? out.v : out.err;
    const post = await run(`
      const [id, prefs, allOn] = arguments;
      // Close any extra tabs/popups a case left open.
      for (const p of doc.querySelectorAll("menupopup, panel")) { try { if (p.state === "open") p.hidePopup(); } catch {} }
      while (gBrowser.tabs.length > 1) gBrowser.removeTab(gBrowser.tabs.at(-1), { animate: false });
      await sleep(250);
      const errors = [...Services.vfxTestErrors];
      if (allOn) {
        // Cases may switch their own feature off; all-on mode puts everything back.
        for (const f of VivaldiFox.FEATURES) if (!Services.prefs.getBoolPref("vivaldifox." + f.id + ".enabled", false)) Services.prefs.setBoolPref("vivaldifox." + f.id + ".enabled", true);
        for (const k of Object.keys(prefs)) Services.prefs.clearUserPref("vivaldifox." + id + "." + k);
        await sleep(500);
        return { errors: errors.concat(Services.vfxTestErrors), residue: [], failed: VivaldiFox.status().filter(s => s.error).map(s => s.id + ": " + s.error) };
      }
      // Switch off everything, including features a case enabled itself or left on after failing.
      for (const f of VivaldiFox.FEATURES) if (Services.prefs.getBoolPref("vivaldifox." + f.id + ".enabled", false)) Services.prefs.setBoolPref("vivaldifox." + f.id + ".enabled", false);
      if (id) for (const k of Object.keys(prefs)) Services.prefs.clearUserPref("vivaldifox." + id + "." + k);
      await sleep(400);
      const residue = [...doc.querySelectorAll("[id^='vfx-'], .vfx-panel")].map(e => "#" + e.id).filter(i => i !== "#vfx-menu-options" && i !== "#vfx-toast")
        .concat([...doc.documentElement.attributes].map(a => a.name).filter(n => n.startsWith("vfx-")).map(n => "root@" + n))
        .concat([...doc.documentElement.style].filter(p => p.startsWith("--vfx")).map(p => "root style " + p))
        .concat(Object.keys(win).filter(k => k.startsWith("vfx")).map(k => "window." + k));
      return { errors: errors.concat(Services.vfxTestErrors), residue, stillRunning: id ? st(id).running : VivaldiFox.status().some(s => s.running) };`, [feature, prefs, allOn]);
    r.errors = post.v?.errors || [post.err];
    r.residue = post.v?.residue || [];
    if (post.v?.stillRunning) r.residue.push("still running after disable");
    if (post.v?.failed?.length) r.errors.push(...post.v.failed);
  } catch (e) {
    r.ok = false;
    r.detail = String(e.message || e);
    await run(`Services.prefs.setBoolPref("vivaldifox." + arguments[0] + ".enabled", ${allOn}); return 1;`, [feature]).catch(() => {});
  }
  r.pass = !!r.ok && !(r.errors?.length) && !(r.residue?.length);
  results.push(r);
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${id}${r.pass ? "" : "\n      " + JSON.stringify({ detail: r.detail, errors: r.errors, residue: r.residue }, null, 1).replace(/\n/g, "\n      ")}`);
}

const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} passed on Firefox ${info.version} (${info.build})${allOn ? " [all features on]" : ""}`);
const untested = info.features.map(f => f.id).filter(id => !cases.some(c => c === id || c.startsWith(id + ".")));
if (!only.length && untested.length) console.log("features without a test case:", untested.join(", "));

if (mdOut) {
  const lines = [`### Firefox ${info.version} (build ${info.build})${allOn ? " – all features enabled together" : " – each feature enabled alone"}`, "",
    "| Case | Result | Notes |", "|---|---|---|",
    ...results.map(r => `| \`${r.id}\` | ${r.pass ? "PASS" : "**FAIL**"} | ${String(r.pass ? (typeof r.detail === "string" ? r.detail : "") : JSON.stringify({ d: r.detail, e: r.errors, r: r.residue })).replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 300)} |`),
    "", `**${passed}/${results.length} passed.**`, ""];
  fs.writeFileSync(mdOut, lines.join("\n"));
}
m.close();
server.close();
process.exitCode = passed === results.length ? 0 : 1;
