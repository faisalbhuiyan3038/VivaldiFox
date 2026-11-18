/* MPL-2.0. Per-site extension rules: keep an extension (or all of them) off on
 * one page or domain, and find which extension breaks a site. See gate.sys.mjs
 * and contentGate.sys.mjs for how an extension is kept off a site. */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";
import { ALL, Matcher, SHARED_KEY, siteKeys } from "./rules.sys.mjs";
import { installGates } from "./gate.sys.mjs";
import { advance, begin } from "./finder.sys.mjs";

const WIDGET = "vfx-extension-sites";
const STORE = "extension-site-rules";
const NOTE = "vfx-extension-finder";
const PROCESS_SCRIPT = "chrome://vivaldifox/content/features/extensions.siteRules/content.js";
const UNLOAD = "vfx:extensions.siteRules:unload";

export default {
  async start(scope, ctx) {
    const AM = Fx.AddonManager;
    const saved = await ctx.Store.load(STORE, {});
    if (scope.disposed) return;

    const matcher = new Matcher();
    let addons = [];
    let finder = null;
    let published = "";

    const nameOf = id => addons.find(a => a.id === id)?.name || id;

    /** Saved rules plus whatever the finder is currently trying. */
    const effectiveRules = () => {
      const rules = Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, [...v]]));
      if (finder?.state) rules[finder.key] = [...new Set([...(rules[finder.key] || []), ...finder.state.blocked])];
      return rules;
    };

    const eachBrowser = function* () {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        for (const tab of win.gBrowser?.tabs || []) yield { win, tab, browser: tab.linkedBrowser };
      }
    };

    const refresh = () => {
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        const node = win.document.getElementById(WIDGET);
        if (!node) continue;
        const off = matcher.blockedAt(win.gBrowser.currentURI.spec);
        const text = off.has(ALL) ? "All extensions are off on this site"
          : off.size ? `${off.size} extension${off.size === 1 ? " is" : "s are"} off on this site`
          : "Extension site rules";
        node.style.listStyleImage = `url("${icon(off.size ? "extensionsiteoff" : "extensionsite")}")`;
        node.setAttribute("tooltiptext", text);
      }
    };

    /** Send the rules to every process. Cross-site iframes also need their tab's address. */
    const publish = () => {
      const rules = effectiveRules();
      matcher.set(rules);
      const tops = {};
      if (!matcher.empty) {
        for (const { browser } of eachBrowser()) {
          const spec = browser.currentURI?.spec;
          if (spec && matcher.blockedAt(spec).size) tops[browser.browserId] = spec;
        }
      }
      const value = JSON.stringify({ rules, tops });
      if (value !== published) {
        published = value;
        Services.ppmm.sharedData.set(SHARED_KEY, { rules, tops });
        Services.ppmm.sharedData.flush();
      }
      refresh();
    };

    const reloadTab = browser => { if (ctx.opt("reloadOnChange")) browser.reload(); };

    const changed = win => {
      ctx.Store.save(STORE);
      publish();
      reloadTab(win.gBrowser.selectedBrowser);
    };

    const removeId = (key, id) => {
      const left = (saved[key] || []).filter(x => x !== id);
      if (left.length) saved[key] = left; else delete saved[key];
    };
    const addId = (key, id) => {
      saved[key] = id === ALL ? [ALL] : [...new Set([...(saved[key] || []), id])];
    };

    /** where: "on", "site" or "page". */
    const setRule = (win, keys, id, where) => {
      removeId(keys.domainKey, id);
      removeId(keys.pageKey, id);
      if (where === "site") addId(keys.domainKey, id);
      if (where === "page") addId(keys.pageKey, id);
      changed(win);
    };

    const loadAddons = async () => {
      const all = await AM.getAddonsByTypes(["extension"]);
      addons = all.filter(a => a.isActive && !a.hidden && !a.isSystem && !a.isBuiltin)
        .sort((a, b) => a.name.localeCompare(b.name));
    };
    await loadAddons();
    if (scope.disposed) return;

    // ── Hooks ──
    installGates(scope, matcher);
    publish();
    Services.ppmm.loadProcessScript(PROCESS_SCRIPT, true);
    scope.add(() => {
      Services.ppmm.removeDelayedProcessScript(PROCESS_SCRIPT);
      Services.ppmm.broadcastAsyncMessage(UNLOAD);
      Services.ppmm.sharedData.delete(SHARED_KEY);
      Services.ppmm.sharedData.flush();
    });

    const onAddonChange = () => loadAddons().catch(e => console.error("[vivaldifox:extensions.siteRules]", e));
    const addonListener = { onEnabled: onAddonChange, onDisabled: onAddonChange, onInstalled: onAddonChange, onUninstalled: onAddonChange };
    AM.addAddonListener(addonListener);
    scope.add(() => AM.removeAddonListener(addonListener));

    // Tabs restored before this feature started loaded with every extension on.
    for (const { tab, browser } of eachBrowser()) {
      if (!tab.hasAttribute("pending") && tab.linkedPanel && matcher.blockedAt(browser.currentURI.spec).size) reloadTab(browser);
    }

    // ── Finder ──
    const closeNote = run => {
      try {
        const box = run.win.gBrowser.getNotificationBox(run.browser);
        const note = box.getNotificationWithValue(NOTE);
        if (note) box.removeNotification(note, true);
      } catch {}
    };

    const showNote = async (run, label, buttons) => {
      closeNote(run);
      const box = run.win.gBrowser.getNotificationBox(run.browser);
      const eventCallback = event => { if (event === "dismissed" && finder === run) cancelFinder(); };
      const note = await box.appendNotification(NOTE, { label, priority: box.PRIORITY_INFO_HIGH, eventCallback },
        buttons.map(([text, callback]) => ({
          label: text,
          callback: () => { Services.tm.dispatchToMainThread(callback); },
        })), true);
      // Keep the question on screen through the reload that follows it.
      note.persistence = 3;
      return note;
    };

    const endFinder = () => {
      const run = finder;
      finder = null;
      publish();
      return run;
    };

    const cancelFinder = ({ reload = true } = {}) => {
      if (!finder) return;
      const run = endFinder();
      closeNote(run);
      if (reload) reloadTab(run.browser);
    };
    scope.add(() => cancelFinder({ reload: false }));

    const finish = async (run, result) => {
      const { domain, domainKey } = run.keys;
      const keep = ids => () => {
        closeNote(run);
        for (const id of ids) addId(domainKey, id);
        ctx.Store.save(STORE);
        publish();
        run.browser.reload();
      };
      const dismiss = () => closeNote(run);
      if (result.done === "found") {
        await showNote(run, `"${nameOf(result.id)}" is breaking ${domain}.`, [
          ["Keep Off on This Site", keep([result.id])], ["Dismiss", dismiss],
        ]);
      } else if (result.done === "multiple") {
        await showNote(run, `More than one extension is breaking ${domain}.`, [
          ["Keep All Off on This Site", keep(result.all)], ["Dismiss", dismiss],
        ]);
      } else {
        await showNote(run, `Site rules did not fix ${domain}. Try turning extensions off completely in about:addons to check.`, [["Dismiss", dismiss]]);
      }
      run.browser.reload();
    };

    const ask = async run => {
      const { phase, blocked, all } = run.state;
      const label = phase === "confirm" ? `All extensions are off on ${run.keys.domain}. Does the site work now?`
        : phase === "verify" ? `Only "${nameOf(blocked[0])}" is off. Does the site work now?`
        : `${blocked.length} of ${all.length} extensions are off. Does the site work now?`;
      const answer = works => () => {
        if (finder !== run) return;
        const next = advance(run.state, works);
        if (next.done) {
          endFinder();
          finish(run, next).catch(e => console.error("[vivaldifox:extensions.siteRules]", e));
        } else {
          run.state = next;
          publish();
          ask(run).catch(e => console.error("[vivaldifox:extensions.siteRules]", e));
        }
      };
      await showNote(run, label, [["Works Now", answer(true)], ["Still Broken", answer(false)], ["Cancel", () => cancelFinder()]]);
      if (finder === run) run.browser.reload();
    };

    const startFinder = win => {
      const browser = win.gBrowser.selectedBrowser;
      const keys = siteKeys(browser.currentURI.spec);
      if (!keys) return toast(win, "Site rules work on web pages only");
      if (finder) return toast(win, "The extension finder is already running");
      const off = matcher.blockedAt(browser.currentURI.spec);
      const ids = off.has(ALL) ? [] : addons.map(a => a.id).filter(id => !off.has(id));
      if (!ids.length) return toast(win, "No extensions are running on this site");
      finder = { win, browser, keys, key: keys.domainKey, state: begin(ids) };
      publish();
      ask(finder).catch(e => console.error("[vivaldifox:extensions.siteRules]", e));
    };

    // ── Button ──
    const populate = (popup, win) => {
      const doc = win.document;
      const spec = win.gBrowser.currentURI.spec;
      const keys = siteKeys(spec);
      const savedKeys = Object.keys(saved);

      if (keys) {
        const { domain, domainKey, pageKey } = keys;
        const siteAll = saved[domainKey]?.includes(ALL), pageAll = saved[pageKey]?.includes(ALL);
        popup.append(
          h(doc, "menuitem", { label: "Find Problem Extension on This Site…", disabled: !!finder, oncommand: () => startFinder(win) }),
          h(doc, "menuseparator"),
          h(doc, "menuitem", { type: "checkbox", label: `Disable All on ${domain}`, checked: !!siteAll, oncommand: () => setRule(win, keys, ALL, siteAll ? "on" : "site") }),
          h(doc, "menuitem", { type: "checkbox", label: "Disable All on This Page", checked: !!pageAll, oncommand: () => setRule(win, keys, ALL, pageAll ? "on" : "page") }),
          h(doc, "menuseparator"),
        );
        if (!addons.length) popup.append(h(doc, "menuitem", { label: "No extensions running", disabled: true }));
        for (const a of addons) {
          const state = saved[domainKey]?.includes(a.id) ? "site" : saved[pageKey]?.includes(a.id) ? "page" : "on";
          const radio = (where, label) => h(doc, "menuitem", {
            type: "radio", name: `vfx-site-${a.id}`, label, checked: state === where,
            oncommand: () => setRule(win, keys, a.id, where),
          });
          popup.append(h(doc, "menu", { label: state === "on" ? a.name : `${a.name} (off here)`, disabled: !!(siteAll || pageAll) }, [
            h(doc, "menupopup", {}, [radio("on", "On"), radio("site", `Off on ${domain}`), radio("page", "Off on This Page")]),
          ]));
        }
        popup.append(h(doc, "menuseparator"));
        const hasRule = saved[domainKey] || saved[pageKey];
        popup.append(h(doc, "menuitem", {
          label: "Clear Rules for This Site", disabled: !hasRule,
          oncommand: () => { delete saved[domainKey]; delete saved[pageKey]; changed(win); },
        }));
      } else {
        popup.append(h(doc, "menuitem", { label: "Site rules work on web pages only", disabled: true }));
      }

      popup.append(h(doc, "menu", { label: `All Saved Rules (${savedKeys.length})`, disabled: !savedKeys.length }, [
        h(doc, "menupopup", {}, savedKeys.map(key => {
          const ids = saved[key];
          const what = ids.includes(ALL) ? "all extensions" : ids.map(nameOf).join(", ");
          return h(doc, "menuitem", {
            label: `Remove: ${key.replace(/^(domain|page):/, "")} (${what})`,
            oncommand: () => { delete saved[key]; changed(win); },
          });
        })),
      ]));
    };

    menuWidget(ctx, scope, {
      id: WIDGET, label: "Extension Site Rules", tooltip: "Extension site rules", icon: icon("extensionsite"),
      onCreated: () => Services.tm.dispatchToMainThread(refresh),
      populate,
    });

    ctx.Commands.register(scope, { id: "extensions.siteRules.find", label: "Find the extension breaking this site", run: startFinder });

    // ── Per-window tracking, shared with window() below ──
    this.onLocation = (browser, spec) => {
      if (finder?.browser === browser && siteKeys(spec)?.domainKey !== finder.key) cancelFinder({ reload: false });
      publish();
    };
    this.onTabClose = browser => { if (finder?.browser === browser) cancelFinder({ reload: false }); };
    this.refresh = refresh;
    scope.add(() => { this.onLocation = this.onTabClose = this.refresh = null; });
  },

  window(win, scope) {
    const listener = {
      onLocationChange: (browser, webProgress, _request, location) => {
        if (webProgress.isTopLevel) this.onLocation?.(browser, location.spec);
      },
    };
    win.gBrowser.addTabsProgressListener(listener);
    scope.add(() => win.gBrowser.removeTabsProgressListener(listener));
    scope.listen(win.gBrowser.tabContainer, "TabSelect", () => this.refresh?.());
    scope.listen(win.gBrowser.tabContainer, "TabClose", e => this.onTabClose?.(e.target.linkedBrowser));
  },
};
