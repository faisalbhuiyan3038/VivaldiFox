assert(Services.prefs.getBoolPref("browser.ctrlTab.sortByRecentlyUsed") === true, "pref applied");
assert(!Services.prefs.prefHasUserValue("browser.ctrlTab.sortByRecentlyUsed"), "no user pref written");
return "native pref overridden on default branch only";
