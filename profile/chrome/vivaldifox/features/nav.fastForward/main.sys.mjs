/* MPL-2.0. A1: Fast Forward / Rewind toolbar buttons and commands. */
import { icon } from "../../core/ui.sys.mjs";
import { contentScript, ask } from "../../core/content.sys.mjs";

const SYS = () => Services.scriptSecurityManager.getSystemPrincipal();

/** Rewind: back to the first page visited on the current site in this tab. */
function rewind(win) {
  const browser = win.gBrowser.selectedBrowser;
  const sh = browser.browsingContext?.sessionHistory;
  if (!sh || sh.index <= 0) return false;
  const host = uri => { try { return uri.host; } catch { return uri.spec; } };
  const cur = host(sh.getEntryAtIndex(sh.index).URI);
  let i = sh.index;
  while (i > 0 && host(sh.getEntryAtIndex(i - 1).URI) === cur) i--;
  // Already at the first page of this site: fall back to the very first entry.
  if (i === sh.index) i = 0;
  browser.gotoIndex(i);
  return true;
}

/** Guess the next URL by incrementing the last number in the path or query. */
export function guessNextUrl(spec) {
  let u;
  try { u = new URL(spec); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  // Prefer explicit paging params.
  for (const key of ["page", "p", "pg", "paged", "start", "offset"]) {
    const v = u.searchParams.get(key);
    if (v && /^\d+$/.test(v)) {
      const step = key === "start" || key === "offset" ? 10 : 1;
      u.searchParams.set(key, String(Number(v) + step));
      return u.href;
    }
  }
  const m = /^(.*?)(\d+)(\D*)$/.exec(u.pathname);
  if (m && m[2].length < 6) {
    const n = String(Number(m[2]) + 1).padStart(m[2].length, "0");
    u.pathname = m[1] + n + m[3];
    return u.href;
  }
  return null;
}

async function fastForward(win, ctx) {
  const browser = win.gBrowser.selectedBrowser;
  const found = await ask(browser, "vfx:ff:findNext");
  let href = found?.href;
  if (!href && ctx.opt("guessUrl")) href = guessNextUrl(browser.currentURI.spec);
  if (href) {
    browser.fixupAndLoadURIString(href, { triggeringPrincipal: browser.contentPrincipal || SYS() });
    return href;
  }
  // Nothing to fast-forward to: jump to the end of this tab's forward history.
  const sh = browser.browsingContext?.sessionHistory;
  if (sh && sh.index < sh.count - 1) browser.gotoIndex(sh.count - 1);
  return null;
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "nav.rewind", label: "Rewind (first page of this site)", run: rewind });
    ctx.Commands.register(scope, { id: "nav.fastForward", label: "Fast forward (next page)", run: w => fastForward(w, ctx) });
    ctx.widget(scope, { id: "vfx-rewind", label: "Rewind", tooltip: "Rewind to the first page of this site", icon: icon("rewind"), onCommand: (_e, w) => rewind(w) });
    ctx.widget(scope, { id: "vfx-fastforward", label: "Fast Forward", tooltip: "Fast forward to the next page", icon: icon("fastforward"), onCommand: (_e, w) => fastForward(w, ctx) });
  },
  window(win, scope, ctx) {
    contentScript(scope, win, ctx.id);
    win.vfxFastForward = { rewind: () => rewind(win), fastForward: () => fastForward(win, ctx), guessNextUrl };
    scope.add(() => delete win.vfxFastForward);
  },
};
