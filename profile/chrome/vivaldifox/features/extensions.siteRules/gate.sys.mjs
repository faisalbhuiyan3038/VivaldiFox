/* MPL-2.0. Parent-process gates: stops webRequest listeners and
 * declarativeNetRequest rules of an extension on the sites where it is off.
 * Firefox has no public API for this, so these wrap two internals. Starting
 * throws if either is gone, which reports the feature as failed in settings. */

/** The address of the tab a request belongs to. */
function topUrl(channel) {
  if (channel.type === "main_frame") return channel.finalURL;
  try {
    const spec = channel.browserElement?.currentURI?.spec;
    if (spec && /^https?:/.test(spec)) return spec;
  } catch {}
  try {
    const top = channel.frameAncestors?.at(-1)?.url;
    if (top) return top;
  } catch {}
  return channel.documentURL || channel.originURL || null;
}

function gateWebRequest(scope, matcher) {
  const proto = ChannelWrapper.prototype;
  const original = proto.matches;
  if (typeof original !== "function") throw new Error("ChannelWrapper.matches is not available");
  proto.matches = function (filter, policy, extra) {
    // Proxy authentication is browser-wide, so it is never gated by site.
    if (policy && !extra?.isProxy && !matcher.empty && matcher.mayBlock(policy.id) && matcher.blocked(policy.id, topUrl(this))) {
      return false;
    }
    return original.call(this, filter, policy, extra);
  };
  scope.add(() => { proto.matches = original; });
}

function gateDNR(scope, matcher) {
  const { ExtensionDNR } = ChromeUtils.importESModule("resource://gre/modules/ExtensionDNR.sys.mjs");
  const original = ExtensionDNR.beforeWebRequestEvent;
  if (typeof original !== "function" || typeof ExtensionDNR.getRuleManager !== "function") {
    throw new Error("ExtensionDNR hooks are not available");
  }
  const noRules = ruleset => Object.create(ruleset, { rules: { value: [] } });

  ExtensionDNR.beforeWebRequestEvent = (channel, kind) => {
    if (kind !== "onBeforeRequest" || matcher.empty) return original(channel, kind);
    const url = topUrl(channel);
    const restore = [];
    try {
      for (const policy of WebExtensionPolicy.getActiveExtensions()) {
        if (!matcher.blocked(policy.id, url) || !policy.extension) continue;
        const rm = ExtensionDNR.getRuleManager(policy.extension, false);
        if (!rm) continue;
        const { sessionRules, dynamicRules, enabledStaticRules } = rm;
        restore.push(() => Object.assign(rm, { sessionRules, dynamicRules, enabledStaticRules }));
        // Evaluation is synchronous, so the rules are only hidden for this call.
        Object.assign(rm, { sessionRules: noRules(sessionRules), dynamicRules: noRules(dynamicRules), enabledStaticRules: [] });
      }
      return original(channel, kind);
    } finally {
      for (const fn of restore) fn();
    }
  };
  scope.add(() => { ExtensionDNR.beforeWebRequestEvent = original; });
}

export function installGates(scope, matcher) {
  gateWebRequest(scope, matcher);
  gateDNR(scope, matcher);
}
