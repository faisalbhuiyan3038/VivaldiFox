#!/usr/bin/env node
// Test harness CLI. Drives a private copy of Firefox through Marionette.
//
//   node test/fx.mjs start [stable|nightly] [--keep] [--no-mod]
//   node test/fx.mjs eval  "<chrome-context JS function body>"   (or @file.js)
//   node test/fx.mjs aeval "<async body; call resolve(v)>"       (or @file.js)
//   node test/fx.mjs shot  out.png
//   node test/fx.mjs stop
//
// `start` creates a clean profile under .test/profile-<channel>, installs the
// mod into it and into the Firefox copy, then launches with Marionette on.
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marionette } from "./lib/marionette.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = path.join(ROOT, ".test");
const STATE = path.join(T, "state.json");
const PORT = 2829;

const [cmd, ...rest] = process.argv.slice(2);

function installMod(appDir, profile) {
  fs.copyFileSync(path.join(ROOT, "install", "config.js"), path.join(appDir, "config.js"));
  fs.mkdirSync(path.join(appDir, "defaults", "pref"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "install", "config-prefs.js"), path.join(appDir, "defaults", "pref", "config-prefs.js"));
  const dst = path.join(profile, "chrome");
  fs.rmSync(path.join(dst, "vivaldifox"), { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, "profile", "chrome"), dst, { recursive: true });
}

async function session() {
  const m = await Marionette.connect(PORT);
  await m.newSession();
  await m.setContext("chrome");
  return m;
}

const body = a => (a.startsWith("@") ? fs.readFileSync(a.slice(1), "utf8") : a);

if (cmd === "start") {
  const channel = rest.find(a => !a.startsWith("--")) || "stable";
  const appDir = path.join(T, `fx-${channel}`);
  const profile = path.join(T, `profile-${channel}`);
  if (!rest.includes("--keep")) fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, "user.js"), [
    `user_pref("marionette.port", ${PORT});`,
    `user_pref("browser.shell.checkDefaultBrowser", false);`,
    `user_pref("browser.aboutwelcome.enabled", false);`,
    `user_pref("datareporting.policy.dataSubmissionEnabled", false);`,
    `user_pref("browser.startup.homepage_override.mstone", "ignore");`,
    `user_pref("startup.homepage_welcome_url", "");`,
    `user_pref("browser.tabs.warnOnClose", false);`,
    `user_pref("browser.warnOnQuit", false);`,
    `user_pref("devtools.chrome.enabled", true);`,
    `user_pref("browser.sessionstore.resume_from_crash", false);`,
    `user_pref("app.update.enabled", false);`,
    `user_pref("termsofuse.bypassNotification", true);`,
    `user_pref("browser.preonboarding.enabled", false);`,
    ...rest.filter(a => a.startsWith("--pref=")).map(a => {
      const [k, v] = a.slice(7).split("=");
      return `user_pref("${k}", ${v});`;
    }),
  ].join("\n"));
  if (!rest.includes("--no-mod")) installMod(appDir, profile);
  const out = fs.openSync(path.join(T, `firefox-${channel}.log`), "w");
  const child = spawn(path.join(appDir, "firefox.exe"),
    ["-profile", profile, "-no-remote", "-marionette", "-purgecaches", "about:blank"],
    { detached: true, stdio: ["ignore", out, out], env: { ...process.env, MOZ_CRASHREPORTER_DISABLE: "1", MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" } });
  child.unref();
  fs.writeFileSync(STATE, JSON.stringify({ pid: child.pid, channel, profile, appDir }));
  const m = await session();
  const info = await m.exec(`return {v: Services.appinfo.version, build: Services.appinfo.appBuildID, mod: Services.prefs.getPrefType("vivaldifox.enabled") != 0};`);
  console.log(JSON.stringify(info));
  m.close();
} else if (cmd === "eval" || cmd === "aeval") {
  const m = await session();
  try {
    const v = await m.exec(body(rest[0]), rest.slice(1).map(a => { try { return JSON.parse(a); } catch { return a; } }), { async: cmd === "aeval" });
    console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1));
  } catch (e) {
    console.error("ERR", e.stack);
    process.exitCode = 1;
  }
  m.close();
} else if (cmd === "shot") {
  const m = await session();
  fs.writeFileSync(rest[0], await m.screenshot());
  console.log("saved", rest[0]);
  m.close();
} else if (cmd === "sync") {
  // Re-copy mod files into the running test profile (needs restart to apply JS).
  const s = JSON.parse(fs.readFileSync(STATE, "utf8"));
  installMod(s.appDir, s.profile);
  console.log("synced");
} else if (cmd === "stop") {
  try {
    const m = await Marionette.connect(PORT, "127.0.0.1", 2);
    await m.newSession();
    await m.send("Marionette:Quit", { flags: ["eForceQuit"] }).catch(() => {});
    m.close();
  } catch {}
  try {
    const s = JSON.parse(fs.readFileSync(STATE, "utf8"));
    await new Promise(r => setTimeout(r, 1500));
    try { execSync(`taskkill /PID ${s.pid} /T /F`, { stdio: "ignore" }); } catch {}
  } catch {}
  console.log("stopped");
} else {
  console.log("usage: fx.mjs start|eval|aeval|shot|sync|stop");
}
