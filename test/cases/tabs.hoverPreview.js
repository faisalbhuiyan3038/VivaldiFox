assert(Services.prefs.getBoolPref("browser.tabs.hoverPreview.enabled"), "hover preview on");
assert(Services.prefs.getBoolPref("browser.tabs.hoverPreview.showThumbnails"), "thumbnails on");
return "native prefs applied";
