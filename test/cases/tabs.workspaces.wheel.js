// Scrolling over the workspace button switches workspaces, one step per gesture.
const W = win.vfxWorkspaces;
const second = W.create("Wheel");
W.switchTo("default");
await sleep(200);
const btn = await waitFor(() => $("#vfx-workspaces"), "workspace button");
const wheel = dy => btn.dispatchEvent(new win.WheelEvent("wheel", { deltaY: dy, deltaMode: 0, bubbles: true, cancelable: true }));
wheel(100);
await waitFor(() => W.active() === second.id, "scroll down: next workspace");
wheel(100);
await sleep(50);
assert(W.active() === second.id, "cooldown: momentum does not skip ahead");
await sleep(350);
wheel(-100);
await waitFor(() => W.active() === "default", "scroll up: previous workspace");
W.remove(second.id);
return "wheel switches workspaces with a cooldown";
