// VivaldiFox autoconfig bootstrap. Goes in <firefox>/defaults/pref/
pref("general.config.filename", "config.js");
pref("general.config.obscure_value", 0);
// Privileged loader code needs the autoconfig sandbox off (release + beta).
pref("general.config.sandbox_enabled", false);
