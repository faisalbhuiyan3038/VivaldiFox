document.documentElement.setAttribute("data-vfx-probe", "1");
if (window !== window.top) window.parent.postMessage("vfx-probe-frame", "*");
