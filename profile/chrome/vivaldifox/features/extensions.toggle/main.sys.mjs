/* MPL-2.0. One toolbar button that switches extensions on and off, all of them
 * or a chosen group, through the public AddonManager API. The switch is the
 * same one as in about:addons, so it applies to the whole browser. */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";
import { toast } from "../../core/toast.sys.mjs";
import { Fx } from "../../core/fx.sys.mjs";

const WIDGET = "vfx-extensions";
const plural = n => `${n} extension${n === 1 ? "" : "s"}`;

export default {
  async start(scope, ctx) {
    const AM = Fx.AddonManager;
    let addons = [];

    const idList = key => {
      const v = ctx.opt(key);
      return new Set(Array.isArray(v) ? v : []);
    };
    const canSwitch = a => !!(a.permissions & (AM.PERM_CAN_ENABLE | AM.PERM_CAN_DISABLE));
    const usable = () => addons.filter(canSwitch);

    const refresh = () => {
      const on = addons.filter(a => !a.userDisabled).length;
      const hint = idList("selected").size ? "selected extensions" : "all extensions";
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        const node = win.document.getElementById(WIDGET);
        if (!node) continue;
        node.style.listStyleImage = `url("${icon(on ? "extensions" : "extensionsoff")}")`;
        node.setAttribute("tooltiptext", `Extensions: ${on} of ${addons.length} on\nClick for the list. Middle-click toggles ${hint}.`);
      }
    };

    /** Every change runs in turn, so a refresh never sees a half-finished toggle. */
    let queue = Promise.resolve();
    const enqueue = fn => (queue = queue.then(fn).catch(e => console.error("[vivaldifox:extensions.toggle]", e)));

    const reload = async () => {
      const all = await AM.getAddonsByTypes(["extension"]);
      addons = all.filter(a => !a.hidden && !a.isSystem && !a.isBuiltin)
        .sort((a, b) => a.name.localeCompare(b.name));
      // Forget extensions that were removed, or switched back on somewhere else.
      const paused = idList("paused");
      const kept = addons.filter(a => paused.has(a.id) && a.userDisabled).map(a => a.id);
      if (kept.length !== paused.size) ctx.setOpt("paused", kept);
      refresh();
    };

    /** Returns how many extensions actually changed. */
    const apply = async (list, on) => {
      const results = await Promise.allSettled(list.map(a => (on ? a.enable() : a.disable())));
      const failed = results.filter(r => r.status === "rejected");
      for (const r of failed) console.error("[vivaldifox:extensions.toggle]", r.reason);
      return list.length - failed.length;
    };

    /**
     * Turn the group off if any of it is on. Otherwise bring back what this
     * button turned off, so an extension you had disabled yourself stays off.
     */
    const toggle = (win, ids) => enqueue(async () => {
      const pool = usable().filter(a => !ids || ids.has(a.id));
      if (!pool.length) return toast(win, "No extensions to switch");
      const paused = idList("paused");
      const running = pool.filter(a => !a.userDisabled);
      if (running.length) {
        const done = await apply(running, false);
        for (const a of running) if (a.userDisabled) paused.add(a.id);
        ctx.setOpt("paused", [...paused]);
        toast(win, `Disabled ${plural(done)}`);
      } else {
        let wake = pool.filter(a => paused.has(a.id));
        if (!wake.length && ids) wake = pool;
        if (!wake.length) return toast(win, "Nothing to restore");
        const done = await apply(wake, true);
        for (const a of wake) if (!a.userDisabled) paused.delete(a.id);
        ctx.setOpt("paused", [...paused]);
        toast(win, `Enabled ${plural(done)}`);
      }
      await reload();
    });

    const toggleAll = win => toggle(win, null);
    const toggleDefault = win => {
      const selected = idList("selected");
      return toggle(win, selected.size ? selected : null);
    };
    const switchOne = addon => enqueue(async () => {
      await apply([addon], addon.userDisabled);
      await reload();
    });
    const choose = id => {
      const selected = idList("selected");
      if (!selected.delete(id)) selected.add(id);
      ctx.setOpt("selected", [...selected]);
      refresh();
    };

    await reload();
    if (scope.disposed) return;

    const onChange = () => enqueue(reload);
    const listener = { onEnabled: onChange, onDisabled: onChange, onInstalled: onChange, onUninstalled: onChange };
    AM.addAddonListener(listener);
    scope.add(() => AM.removeAddonListener(listener));

    // Turning the feature off must not leave extensions switched off by it.
    scope.add(() => {
      const ids = [...idList("paused")];
      ctx.setOpt("paused", []);
      if (ids.length) {
        AM.getAddonsByIDs(ids)
          .then(list => Promise.allSettled(list.filter(Boolean).map(a => a.enable())))
          .catch(e => console.error("[vivaldifox:extensions.toggle]", e));
      }
    });

    menuWidget(ctx, scope, {
      id: WIDGET, label: "Extensions", tooltip: "Extensions", icon: icon("extensions"),
      onCreated(node, win) {
        node.addEventListener("click", e => {
          if (e.button !== 1 || e.target !== node) return;
          e.preventDefault();
          toggleDefault(win);
        });
        Services.tm.dispatchToMainThread(refresh);
      },
      populate(popup, win) {
        const doc = win.document, list = usable();
        const paused = idList("paused"), selected = idList("selected");
        const group = list.filter(a => selected.has(a.id));
        const anyOn = list.some(a => !a.userDisabled);
        const groupOn = group.some(a => !a.userDisabled);

        popup.append(
          h(doc, "menuitem", {
            label: anyOn ? "Disable All Extensions" : "Restore Extensions",
            disabled: !anyOn && !list.some(a => paused.has(a.id)),
            oncommand: () => toggleAll(win),
          }),
          h(doc, "menuitem", {
            label: `${groupOn || !group.length ? "Disable" : "Enable"} Selected (${group.length})`,
            disabled: !group.length,
            oncommand: () => toggle(win, selected),
          }),
          h(doc, "menu", { label: "Choose Selected Extensions", disabled: !list.length }, [
            h(doc, "menupopup", {}, list.map(a => h(doc, "menuitem", {
              type: "checkbox", label: a.name, closemenu: "none",
              checked: selected.has(a.id), oncommand: () => choose(a.id),
            }))),
          ]),
          h(doc, "menuseparator"),
        );
        if (!addons.length) popup.append(h(doc, "menuitem", { label: "No extensions installed", disabled: true }));
        for (const a of addons) {
          popup.append(h(doc, "menuitem", {
            type: "checkbox", label: a.name, closemenu: "none",
            checked: !a.userDisabled, disabled: !canSwitch(a),
            oncommand: () => switchOne(a),
          }));
        }
      },
    });

    ctx.Commands.register(scope, { id: "extensions.toggle", label: "Toggle selected extensions (all if none are selected)", run: toggleDefault });
    ctx.Commands.register(scope, { id: "extensions.toggleAll", label: "Disable / restore all extensions", run: toggleAll });
  },
};
