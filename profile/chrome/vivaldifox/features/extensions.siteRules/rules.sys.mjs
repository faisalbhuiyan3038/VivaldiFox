/* MPL-2.0. Site rule keys and matching. Loaded in the parent and in content
 * processes, so this file must not touch anything parent-only. */

export const ALL = "*";
export const SHARED_KEY = "vivaldifox/extensionSiteRules";

/** The rule keys of a URL, or null when site rules do not apply to it. */
export function siteKeys(spec) {
  let uri;
  try { uri = Services.io.newURI(spec); } catch { return null; }
  if (!uri.schemeIs("http") && !uri.schemeIs("https")) return null;
  let domain;
  // IP addresses and single-label hosts such as localhost have no base domain.
  try { domain = Services.eTLD.getBaseDomain(uri); } catch { domain = uri.host; }
  return { domain, domainKey: `domain:${domain}`, pageKey: `page:${uri.prePath}${uri.filePath}` };
}

/** Answers "is this extension off on this top-level URL?" for a set of rules. */
export class Matcher {
  #rules = {};
  #ids = new Set();
  #cache = new Map();

  set(rules) {
    this.#rules = rules || {};
    this.#ids = new Set(Object.values(this.#rules).flat());
    this.#cache.clear();
  }

  get empty() { return !this.#ids.size; }

  /** Cheap check that avoids working out the top-level URL for most requests. */
  mayBlock(id) { return this.#ids.has(ALL) || this.#ids.has(id); }

  /** The extension ids (or ALL) that are off on `spec`. */
  blockedAt(spec) {
    let set = this.#cache.get(spec);
    if (set) return set;
    set = new Set();
    const keys = spec ? siteKeys(spec) : null;
    if (keys) for (const id of [...(this.#rules[keys.domainKey] || []), ...(this.#rules[keys.pageKey] || [])]) set.add(id);
    if (this.#cache.size > 200) this.#cache.clear();
    this.#cache.set(spec, set);
    return set;
  }

  blocked(id, spec) {
    if (!id || !spec || !this.mayBlock(id)) return false;
    const set = this.blockedAt(spec);
    return set.has(ALL) || set.has(id);
  }
}
