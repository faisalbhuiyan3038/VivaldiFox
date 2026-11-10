// VivaldiFox CSS-only mode: prefs to copy into <profile>/user.js
// (or create by hand in about:config). Delete the lines you do not want;
// every line is independent of the others.

// Required for any userChrome.css to load.
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// ── CSS-only features (fallback/userChrome.css) ──────────────────────────
user_pref("vivaldifox.tabs.appearance.enabled", true);  // close button on hover
user_pref("vivaldifox.look.rounding.enabled", true);    // rounded corners
user_pref("vivaldifox.look.autohide.enabled", false);   // auto-hiding toolbars

// ── Features that are plain Firefox prefs (no mod code involved) ─────────
user_pref("browser.ctrlTab.sortByRecentlyUsed", true);            // tabs.cycler
user_pref("browser.tabs.hoverPreview.enabled", true);             // tabs.hoverPreview
user_pref("browser.tabs.hoverPreview.showThumbnails", true);
user_pref("browser.tabs.closeTabByDblclick", true);               // tabs.clickBehaviors
user_pref("toolkit.tabbox.switchByScrolling", true);
user_pref("browser.zoom.siteSpecific", false);                    // zoom.perTab
user_pref("browser.search.context.loadInBackground", true);       // input.selectionSearch
user_pref("browser.tabs.splitView.enabled", true);                // tabs.tiling (native Split View)
user_pref("browser.tabs.groups.enabled", true);                   // native tab groups
// Tab bar on the left (tabs.position = left); set position_start false for right.
// user_pref("sidebar.revamp", true);
// user_pref("sidebar.verticalTabs", true);
// user_pref("sidebar.position_start", true);
