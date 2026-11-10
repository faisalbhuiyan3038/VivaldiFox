const html = "<title>SN</title><style>a{position:absolute;width:80px;height:20px}</style>" +
  "<a id=a href='#a' style='left:20px;top:20px'>A</a><a id=b href='#b' style='left:300px;top:20px'>B</a>" +
  "<a id=c href='#c' style='left:20px;top:200px'>C</a><a id=d href='#d' style='left:300px;top:200px'>D</a><input id=i style='position:absolute;left:20px;top:400px'>";
const t = await openTab(web(html)); gBrowser.selectedTab = t; t.linkedBrowser.focus(); await sleep(300);
const press = k => inContent(t, "const d=content.document;(d.activeElement||d.body).dispatchEvent(new content.KeyboardEvent('keydown',{key:'" + k + "',shiftKey:true,bubbles:true,cancelable:true}));return d.activeElement.id");
await inContent(t, "content.document.getElementById('a').focus()");
assert(await press("ArrowRight") === "b", "right: a -> b");
assert(await press("ArrowDown") === "d", "down: b -> d");
assert(await press("ArrowLeft") === "c", "left: d -> c");
assert(await press("ArrowUp") === "a", "up: c -> a");
await inContent(t, "content.document.getElementById('i').focus()");
assert(await press("ArrowUp") === "i", "text field keeps Shift+Arrow for selection");
return "focus moved a->b->d->c->a geometrically; text inputs left alone";
