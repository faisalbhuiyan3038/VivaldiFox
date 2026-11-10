/* MPL-2.0. Frame script for capture: report page and viewport geometry. */
/* global content, addMessageListener, removeMessageListener, sendAsyncMessage */
(function () {
  const onMetrics = msg => {
    let result = null;
    try {
      const win = content, doc = win.document, root = doc.documentElement, body = doc.body;
      result = {
        scrollX: win.scrollX, scrollY: win.scrollY,
        viewWidth: win.innerWidth, viewHeight: win.innerHeight,
        pageWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0, win.innerWidth + (win.scrollMaxX || 0)),
        pageHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0, win.innerHeight + (win.scrollMaxY || 0)),
        dpr: win.devicePixelRatio,
        title: doc.title,
      };
    } catch {}
    sendAsyncMessage("vfx:capture:metrics:reply", { id: msg.data.id, result });
  };
  const onUnload = () => {
    removeMessageListener("vfx:capture:metrics", onMetrics);
    removeMessageListener("vfx:capture:unload", onUnload);
  };
  addMessageListener("vfx:capture:metrics", onMetrics);
  addMessageListener("vfx:capture:unload", onUnload);
})();
