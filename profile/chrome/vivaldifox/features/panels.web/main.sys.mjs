/* MPL-2.0. P1: Web Panels. Any site pinned in the side panel, optionally with
 * a mobile user agent. Each panel is a real remote <browser>, so sites run in
 * a sandboxed content process exactly like a tab (no iframe, so no
 * X-Frame-Options problems). Approach inspired by Floorp's web panels
 * (MPL-2.0); code written for this project. */
import { h, icon, promptText } from "../../core/ui.sys.mjs";
import { Panels } from "../../core/panels.sys.mjs";

const SYS = () => Services.scriptSecurityManager.getSystemPrincipal();

function mobileUA() {
  const v = Services.appinfo.version.split(".")[0] + ".0";
  return `Mozilla/5.0 (Android 14; Mobile; rv:${v}) Gecko/${v} Firefox/${v}`;
}

function normalizeUrl(input) {
  try {
    const fixed = Services.uriFixup.getFixupURIInfo(input.trim(), Ci.nsIURIFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS).preferredURI;
    return /^https?$/.test(fixed.scheme) ? fixed.spec : null;
  } catch {
    return null;
  }
}

function sitesOf(ctx) {
  const raw = ctx.opt("sites");
  return (Array.isArray(raw) ? raw : []).filter(s => s && typeof s.url === "string" && normalizeUrl(s.url));
}

function buildPanel(node, win, site) {
  const doc = win.document;
  const browser = doc.createXULElement("browser");
  for (const [k, v] of Object.entries({
    type: "content", remote: "true", maychangeremoteness: "true", disableglobalhistory: "true",
    messagemanagergroup: "browsers", context: "contentAreaContextMenu", tooltip: "aHTMLTooltip",
    autocompletepopup: "PopupAutoComplete", flex: "1", class: "vfx-webpanel-browser",
  })) browser.setAttribute(k, v);
  const go = url => browser.fixupAndLoadURIString(url, { triggeringPrincipal: SYS() });
  const btn = (label, tip, fn) => h(doc, "toolbarbutton", { class: "vfx-panel-hbtn", label, tooltiptext: tip, oncommand: fn });
  const bar = h(doc, "hbox", { class: "vfx-p-toolbar" }, [
    btn("←", "Back", () => browser.canGoBack && browser.goBack()),
    btn("→", "Forward", () => browser.canGoForward && browser.goForward()),
    btn("⟳", "Reload", () => browser.reload()),
    btn("⌂", "Panel home page", () => go(site.url)),
    h(doc, "spacer", { flex: "1" }),
    btn("↗", "Open in a tab", () => win.openTrustedLinkIn(browser.currentURI?.spec || site.url, "tab")),
  ]);
  node.append(bar, browser);
  // The browsing context exists once the element is in the document.
  try {
    if (site.mobile !== false && browser.browsingContext) browser.browsingContext.customUserAgent = mobileUA();
  } catch (e) { console.warn("[vivaldifox:panels.web] user agent", e); }
  go(site.url);
  return () => browser.remove();
}

function add(win, ctx) {
  const cur = win.gBrowser.selectedBrowser.currentURI.spec;
  const input = promptText(win, "Add Web Panel", "Address of the site to pin as a panel:", /^https?:/.test(cur) ? cur : "https://");
  if (input === null) return;
  const url = normalizeUrl(input);
  if (!url) {
    Services.prompt.alert(win, "Add Web Panel", "That is not a valid http(s) address.");
    return;
  }
  ctx.setOpt("sites", [...sitesOf(ctx), { url, mobile: true }]);
}

export default {
  start(scope, ctx) {
    ctx.Commands.register(scope, { id: "panels.addWebPanel", label: "Add web panel", run: w => add(w, ctx) });
  },
  window(win, scope, ctx) {
    const doc = win.document;
    sitesOf(ctx).forEach((site, i) => {
      const url = normalizeUrl(site.url);
      let host = url;
      try { host = new URL(url).host; } catch {}
      Panels.register(scope, win, {
        id: `web:${i}`, title: site.title || host, order: 60 + i,
        // page-icon: resolves to the site's favicon once Firefox knows it.
        icon: `page-icon:${url}`,
        build: (node, w) => buildPanel(node, w, { ...site, url }),
        onContext(_e, button) {
          const popup = h(doc, "menupopup", {}, [
            h(doc, "menuitem", { label: `Remove “${site.title || host}”`, oncommand: () => ctx.setOpt("sites", sitesOf(ctx).filter((_s, j) => j !== i)) }),
            h(doc, "menuitem", { label: site.mobile === false ? "Use Mobile Version" : "Use Desktop Version", oncommand: () => ctx.setOpt("sites", sitesOf(ctx).map((s, j) => (j === i ? { ...s, mobile: s.mobile === false } : s))) }),
          ]);
          popup.addEventListener("popuphidden", () => popup.remove());
          doc.getElementById("mainPopupSet").append(popup);
          popup.openPopup(button, "after_start");
        },
      });
    });
    // The "+" entry is itself a (button-only) panel so it lives in the strip.
    Panels.register(scope, win, {
      id: "web:add", title: "Add Web Panel", icon: icon("plus"), order: 99,
      build(node, w) {
        node.append(h(w.document, "vbox", { class: "vfx-p-empty" }, [
          h(w.document, "description", { text: "Pin a website as a panel." }),
          h(w.document, "button", { label: "Add Web Panel…", oncommand: () => add(w, ctx) }),
        ]));
      },
    });
  },
};
