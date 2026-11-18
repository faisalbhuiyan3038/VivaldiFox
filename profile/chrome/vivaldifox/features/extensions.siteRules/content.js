/* MPL-2.0. Process script for extensions.siteRules: installs the content gate. */
/* global Services, ChromeUtils */
(function () {
  if (Services.appinfo.processType !== Services.appinfo.PROCESS_TYPE_CONTENT) return;
  const { install, uninstall } = ChromeUtils.importESModule("chrome://vivaldifox/content/features/extensions.siteRules/contentGate.sys.mjs");
  const UNLOAD = "vfx:extensions.siteRules:unload";
  const onUnload = () => {
    Services.cpmm.removeMessageListener(UNLOAD, onUnload);
    uninstall();
  };
  Services.cpmm.addMessageListener(UNLOAD, onUnload);
  install();
})();
