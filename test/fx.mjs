#!/usr/bin/env node
// Test harness CLI. Drives a private copy of Firefox through Marionette.
//
//   node test/fx.mjs setup [stable|nightly] [--from <dir>]   copy an installed Firefox into .test/
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
  const res = resourcesOf(appDir);
  fs.copyFileSync(path.join(ROOT, "install", "config.js"), path.join(res, "config.js"));
  fs.mkdirSync(path.join(res, "defaults", "pref"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "install", "config-prefs.js"), path.join(res, "defaults", "pref", "config-prefs.js"));
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

/** Usual install locations of each channel, per platform. */
function candidates(channel) {
  const nightly = channel === "nightly";
  if (process.platform === "win32") {
    const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.map(r => path.join(r, nightly ? "Firefox Nightly" : "Mozilla Firefox"));
  }
  if (process.platform === "darwin") return [nightly ? "/Applications/Firefox Nightly.app" : "/Applications/Firefox.app"];
  return nightly ? ["/opt/firefox-nightly", "/usr/lib/firefox-nightly"] : ["/usr/lib/firefox", "/usr/lib64/firefox", "/opt/firefox"];
}
const binaryOf = appDir => process.platform === "win32" ? path.join(appDir, "firefox.exe")
  : process.platform === "darwin" ? path.join(appDir, "Contents", "MacOS", "firefox") : path.join(appDir, "firefox");
/** Folder that holds defaults/ and receives config.js (Resources/ on macOS). */
const resourcesOf = appDir => (process.platform === "darwin" ? path.join(appDir, "Contents", "Resources") : appDir);

if (cmd === "setup") {
  // Copies an installed Firefox into .test/ so tests never touch the real
  // installation (the copy receives the autoconfig hook, the original does not).
  const channel = rest.find(a => !a.startsWith("--")) || "stable";
  const fromIdx = rest.indexOf("--from");
  const from = fromIdx >= 0 ? rest[fromIdx + 1] : candidates(channel).find(d => fs.existsSync(binaryOf(d)));
  if (!from || !fs.existsSync(binaryOf(from))) {
    console.error(`No Firefox ${channel} found. Looked in:\n  ${candidates(channel).join("\n  ")}\nPass --from <folder containing the Firefox binary>.`);
    process.exit(1);
  }
  const dst = path.join(T, `fx-${channel}`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(T, { recursive: true });
  console.log(`copying ${from} -> ${dst} …`);
  fs.cpSync(from, dst, { recursive: true });
  const ini = path.join(resourcesOf(dst), "application.ini");
  const version = fs.existsSync(ini) ? /^Version=(.+)$/m.exec(fs.readFileSync(ini, "utf8"))?.[1] : "?";
  console.log(`ready: Firefox ${version} in ${dst}`);
} else if (cmd === "start") {
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
  if (!fs.existsSync(binaryOf(appDir))) {
    console.error(`No test Firefox in ${appDir}. Run: node test/fx.mjs setup ${channel}`);
    process.exit(1);
  }
  const child = spawn(binaryOf(appDir),
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
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${s.pid} /T /F`, { stdio: "ignore" });
      else process.kill(s.pid, "SIGKILL");
    } catch {}
  } catch {}
  console.log("stopped");
} else {
  console.log("usage: fx.mjs setup|start|eval|aeval|shot|sync|stop");
}
