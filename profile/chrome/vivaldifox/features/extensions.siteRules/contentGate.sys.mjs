/* MPL-2.0. Content-process gate: stops content scripts, executeScript and
 * insertCSS of an extension on the sites where it is off. One copy per process. */
import { Matcher, SHARED_KEY } from "./rules.sys.mjs";

const matcher = new Matcher();
let tops = {};
let scripts = null, owner = null, originalInject = null;

function read() {
  const data = Services.cpmm.sharedData.get(SHARED_KEY);
  matcher.set(data?.rules);
  tops = data?.tops || {};
}
const onChange = e => { if (e.changedKeys.includes(SHARED_KEY)) read(); };

/** The address of the tab that holds `window`, including cross-site iframes. */
function topSpec(window) {
  const bc = window.browsingContext, top = bc.top;
  if (bc === top) return window.location.href;
  return top.docShell?.currentURI?.spec || tops[top.browserId] || null;
}

/** Every injection goes through one method of the content Script class. */
function patch(script) {
  if (owner) return;
  let proto = Object.getPrototypeOf(script);
  while (proto && !Object.hasOwn(proto, "injectInto")) proto = Object.getPrototypeOf(proto);
  if (!proto) throw new Error("content Script.injectInto is not available");
  owner = proto;
  originalInject = proto.injectInto;
  const inject = originalInject;
  proto.injectInto = function (window, ...rest) {
    try {
      if (!matcher.empty && matcher.blocked(this.extension?.id, topSpec(window))) return Promise.resolve();
    } catch (e) { console.error("[vivaldifox:extensions.siteRules]", e); }
    return inject.call(this, window, ...rest);
  };
}

export function install() {
  if (scripts) return;
  read();
  Services.cpmm.sharedData.addEventListener("change", onChange);
  const { ExtensionContent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionContent.sys.mjs");
  scripts = ExtensionContent.contentScripts;
  const get = scripts.get;
  scripts.get = function (matcherArg) {
    const script = get.call(this, matcherArg);
    patch(script);
    return script;
  };
}

export function uninstall() {
  if (!scripts) return;
  Services.cpmm.sharedData.removeEventListener("change", onChange);
  delete scripts.get;
  scripts = null;
  if (owner) owner.injectInto = originalInject;
  owner = originalInject = null;
  matcher.set({});
  tops = {};
}
