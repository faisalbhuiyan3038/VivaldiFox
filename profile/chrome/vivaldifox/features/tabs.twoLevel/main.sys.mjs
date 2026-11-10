/* MPL-2.0. T3: two-level tab stacks.
 *
 * Firefox's native tab groups play the role of Vivaldi's tab stacks:
 *   level 1  the normal tab bar, where every group is kept collapsed, so a
 *            stack shows as its label plus (for the active stack) the current tab;
 *   level 2  a second row listing every tab of the active tab's stack.
 *
 * The feature never creates, moves or regroups tabs: it only sets
 * `group.collapsed` and selects tabs, and it reads state through the public
 * surface of tabbrowser (tab.group, group.tabs, Tab* events). This is still
 * the most version-sensitive feature of the mod because tab groups are young;
 * every native call is guarded, and if groups are unavailable it reports a
 * clear failure instead of half-working.
 */
import { h } from "../../core/ui.sys.mjs";

export default {
  start(scope) {
    scope.nativePref("browser.tabs.groups.enabled", true);
  },
  window(win, scope, ctx) {
    const doc = win.document, gB = win.gBrowser, strip = gB.tabContainer;
    if (!("tabGroups" in gB) && typeof gB.getAllTabGroups !== "function") throw new Error("Tab groups are not available in this Firefox");
    const anchor = doc.getElementById("TabsToolbar");
    if (!anchor) throw new Error("#TabsToolbar not found");
    const autoCollapse = ctx.opt("collapseStacks");

    const row = h(doc, "hbox", { id: "vfx-stack-row", role: "tablist", "aria-label": "Tabs in this stack", hidden: "true" });
    anchor.after(row);
    scope.add(() => row.remove());

    const groups = () => { try { return gB.tabGroups || gB.getAllTabGroups() || []; } catch { return []; } };
    let expandedByUs = new WeakSet();

    const collapseAll = () => {
      if (!autoCollapse) return;
      for (const g of groups()) {
        try {
          if (!g.collapsed) {
            g.collapsed = true;
            expandedByUs.add(g);
          }
        } catch {}
      }
    };

    const render = () => {
      // Stay glued to the tab bar even if another feature relocates it.
      if (row.previousElementSibling !== anchor) anchor.after(row);
      const tab = gB.selectedTab, group = tab?.group;
      const tabs = group ? [...(group.tabs || [])].filter(t => !t.closing) : [];
      if (!group || !tabs.length) {
        row.hidden = true;
        row.replaceChildren();
        return;
      }
      row.hidden = false;
      // Take the colour Firefox itself computed for the group, whatever its token is called.
      let color = "";
      try { color = win.getComputedStyle(group).getPropertyValue("--tab-group-color").trim(); } catch {}
      if (color) row.style.setProperty("--vfx-stack-color", color);
      else row.style.removeProperty("--vfx-stack-color");
      const label = h(doc, "label", { class: "vfx-stack-name", value: group.label || group.name || "Stack", crop: "end" });
      const items = tabs.map(t => {
        const item = h(doc, "hbox", { class: "vfx-stack-tab", role: "tab", "aria-selected": String(t === tab), selected: t === tab ? "true" : null, align: "center", tooltiptext: t.label }, [
          h(doc, "image", { class: "vfx-stack-icon", src: t.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg" }),
          h(doc, "label", { class: "vfx-stack-label", value: t.label, crop: "end", flex: "1" }),
          h(doc, "toolbarbutton", { class: "vfx-stack-close", label: "✕", tooltiptext: "Close tab", oncommand: e => { e.stopPropagation(); gB.removeTab(t, { animate: true }); } }),
        ]);
        item.addEventListener("click", e => {
          if (e.target.closest(".vfx-stack-close")) return;
          if (e.button === 1) gB.removeTab(t, { animate: true });
          else if (e.button === 0) gB.selectedTab = t;
        });
        return item;
      });
      const add = h(doc, "toolbarbutton", {
        class: "vfx-stack-add", label: "+", tooltiptext: "New tab in this stack",
        oncommand: () => {
          const nt = gB.addTrustedTab(win.BROWSER_NEW_TAB_URL || "about:newtab", { inBackground: false });
          try { group.addTabs([nt]); } catch (e) { console.warn("[vivaldifox:twoLevel]", e); }
          gB.selectedTab = nt;
        },
      });
      row.replaceChildren(label, ...items, add);
    };

    let queued = 0;
    const refresh = () => {
      win.clearTimeout(queued);
      queued = win.setTimeout(() => { collapseAll(); render(); }, 30);
    };
    scope.add(() => win.clearTimeout(queued));

    for (const type of ["TabSelect", "TabOpen", "TabClose", "TabMove", "TabGrouped", "TabUngrouped", "TabGroupCreate", "TabGroupRemoved", "TabGroupUpdate", "TabGroupExpand", "TabPinned"]) {
      scope.listen(strip, type, refresh);
    }
    scope.listen(strip, "TabAttrModified", e => {
      const c = e.detail?.changed || [];
      if (e.target.group && e.target.group === gB.selectedTab.group && (c.includes("label") || c.includes("image"))) refresh();
    });

    // Level 1: clicking a stack's label activates the stack instead of unfolding it.
    scope.listen(strip, "click", e => {
      if (!autoCollapse || e.button !== 0) return;
      const labelEl = e.target.closest?.(".tab-group-label, .tab-group-label-container");
      const group = labelEl?.closest("tab-group");
      if (!group) return;
      const tabs = [...(group.tabs || [])].filter(t => !t.closing);
      if (!tabs.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (gB.selectedTab.group !== group) gB.selectedTab = tabs.includes(group.vfxLastTab) ? group.vfxLastTab : tabs[0];
    }, true);
    // Remember the last active tab of each stack.
    scope.listen(strip, "TabSelect", e => { if (e.target.group) e.target.group.vfxLastTab = e.target; });

    // On disable: unfold the stacks this feature folded.
    scope.add(() => {
      for (const g of groups()) {
        if (expandedByUs.has(g)) { try { g.collapsed = false; } catch {} }
        delete g.vfxLastTab;
      }
    });
    // The tab bar can be moved (tabs.position) while this feature is running.
    const mo = new win.MutationObserver(() => { if (row.previousElementSibling !== anchor) refresh(); });
    mo.observe(doc.documentElement, { attributes: true, attributeFilter: ["vfx-tabs-bottom"] });
    scope.add(() => mo.disconnect());
    scope.attr(doc.documentElement, "vfx-two-level", "true");
    collapseAll();
    render();
    win.vfxTwoLevel = { render, row };
    scope.add(() => delete win.vfxTwoLevel);
  },
};
