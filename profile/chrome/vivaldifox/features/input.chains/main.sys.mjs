/* MPL-2.0. I6: command chains. User-defined sequences of commands.
 *
 * `chains` option: [{ id, label, steps: [ "commandId" | {wait: ms} | {open: "url", background?: bool} ] }]
 * Each chain becomes a command "chain.<id>", so it can be bound to a gesture,
 * a shortcut or run from quick commands when those are enabled; the toolbar
 * menu makes chains usable when none of them are.
 */
import { h, icon, menuWidget } from "../../core/ui.sys.mjs";

const sleep = (win, ms) => new Promise(r => win.setTimeout(r, ms));

export async function runChain(win, chain, Commands, gap = 120) {
  const done = [];
  for (const step of chain.steps || []) {
    if (win.closed) break;
    if (typeof step === "string") {
      // Never recurse into chains: avoids accidental infinite loops.
      if (step.startsWith("chain.")) continue;
      done.push([step, Commands.run(step, win)]);
      await sleep(win, gap);
    } else if (step && typeof step.wait === "number") {
      await sleep(win, Math.min(Math.max(step.wait, 0), 60000));
    } else if (step && typeof step.open === "string") {
      win.openTrustedLinkIn(step.open, step.background ? "tabshifted" : "tab");
      await sleep(win, gap);
    }
  }
  return done;
}

function validChains(raw) {
  return (Array.isArray(raw) ? raw : []).filter(c => c && typeof c.id === "string" && /^[\w-]+$/.test(c.id) && Array.isArray(c.steps));
}

export default {
  start(scope, ctx) {
    const chains = validChains(ctx.opt("chains"));
    for (const c of chains) {
      ctx.Commands.register(scope, { id: `chain.${c.id}`, label: `Chain: ${c.label || c.id}`, group: "Chains", run: w => runChain(w, c, ctx.Commands) });
    }
    menuWidget(ctx, scope, {
      id: "vfx-chains", label: "Command Chains", tooltip: "Run a command chain", icon: icon("chain"),
      populate(popup, win) {
        for (const c of chains) {
          popup.append(h(win.document, "menuitem", { label: c.label || c.id, oncommand: () => runChain(win, c, ctx.Commands) }));
        }
        popup.append(h(win.document, "menuseparator"));
        popup.append(h(win.document, "menuitem", { label: "Edit Chains…", oncommand: () => ctx.Commands.run("vfx.options", win) }));
      },
    });
  },
};
