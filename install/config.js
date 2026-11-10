// VivaldiFox loader (first line of an autoconfig file must be a comment).
// >>> vivaldifox-begin
// Pattern adapted from MrOtherGuy/fx-autoconfig (MPL-2.0): register a
// chrome.manifest that lives in the *profile*, then import the boot module.
// Everything else lives in <profile>/chrome/vivaldifox, so this file never
// needs to change between mod versions.
if (!Services.appinfo.inSafeMode) {
  try {
    const m = Services.dirsvc.get("UChrm", Ci.nsIFile);
    m.append("vivaldifox");
    m.append("chrome.manifest");
    if (m.exists()) {
      Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(m);
      ChromeUtils.importESModule("chrome://vivaldifox/content/boot.sys.mjs");
    }
  } catch (e) {
    Cu.reportError(e);
  }
}
// <<< vivaldifox-end
