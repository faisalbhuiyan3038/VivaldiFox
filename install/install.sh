#!/usr/bin/env bash
# Install, update or remove VivaldiFox (Linux / macOS).
#
#   ./install.sh --firefox <firefox app dir> --profile <profile dir>
#   ./install.sh --profile <profile dir> --css-only
#   ./install.sh --firefox <dir> --profile <dir> --uninstall
#
# <firefox app dir> is the folder holding the firefox binary, e.g.
#   Linux:  /usr/lib/firefox   /opt/firefox   ~/firefox
#   macOS:  /Applications/Firefox.app/Contents/Resources
# Flatpak/Snap builds have a read-only application folder: use --css-only
# there, or a tarball build from mozilla.org.
# The hook is merged into an existing config.js (another loader) rather than
# overwriting it; a backup is kept.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BEGIN="// >>> vivaldifox-begin"
END="// <<< vivaldifox-end"
FX="" PROFILE="" CSS_ONLY=0 UNINSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --firefox) FX="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --css-only) CSS_ONLY=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[ -n "$PROFILE" ] || { echo "Missing --profile <dir> (see about:profiles in Firefox)." >&2; exit 2; }
[ -d "$PROFILE" ] || { echo "Profile folder not found: $PROFILE" >&2; exit 1; }
CHROME="$PROFILE/chrome"
MARK="/* vivaldifox-fallback */"
MARK_END="/* vivaldifox-fallback-end */"

strip_block() { # file begin end -> prints file without the marked block
  awk -v b="$2" -v e="$3" 'index($0,b){skip=1} !skip{print} index($0,e){skip=0}' "$1"
}

clear_cache() {
  rm -rf "$PROFILE/startupCache" 2>/dev/null || true
  local name; name="$(basename "$PROFILE")"
  rm -rf "$HOME/.cache/mozilla/firefox/$name/startupCache" "$HOME/Library/Caches/Firefox/Profiles/$name/startupCache" 2>/dev/null || true
}

remove_hook() {
  [ -n "$FX" ] && [ -d "$FX" ] || return 0
  for f in "$FX"/*.js; do
    [ -f "$f" ] || continue
    grep -qF "$BEGIN" "$f" || continue
    strip_block "$f" "$BEGIN" "$END" > "$f.tmp"
    if [ -z "$(grep -v '^[[:space:]]*//' "$f.tmp" | tr -d '[:space:]')" ]; then
      rm -f "$f" "$f.tmp"
      if [ -f "$FX/defaults/pref/config-prefs.js" ] && grep -q "VivaldiFox autoconfig bootstrap" "$FX/defaults/pref/config-prefs.js"; then rm -f "$FX/defaults/pref/config-prefs.js"; fi
      echo "Removed $(basename "$f") (it contained only the VivaldiFox hook)."
    else
      mv "$f.tmp" "$f"
      echo "Removed the VivaldiFox block from $(basename "$f"); the other loader in it is untouched."
    fi
  done
  rm -f "$FX/defaults/pref/vivaldifox-prefs.js"
}

if [ "$UNINSTALL" = 1 ]; then
  rm -rf "$CHROME/vivaldifox"
  if [ -f "$CHROME/userChrome.css" ] && grep -qF "$MARK" "$CHROME/userChrome.css"; then
    strip_block "$CHROME/userChrome.css" "$MARK" "$MARK_END" > "$CHROME/userChrome.css.tmp"
    if [ -s "$CHROME/userChrome.css.tmp" ] && [ -n "$(tr -d '[:space:]' < "$CHROME/userChrome.css.tmp")" ]; then mv "$CHROME/userChrome.css.tmp" "$CHROME/userChrome.css"; else rm -f "$CHROME/userChrome.css" "$CHROME/userChrome.css.tmp"; fi
  fi
  remove_hook || echo "Could not edit $FX (try with sudo)." >&2
  clear_cache
  echo "Uninstalled. Notes/sessions stay in $PROFILE/vivaldifox-data."
  exit 0
fi

mkdir -p "$CHROME"

if [ "$CSS_ONLY" = 1 ]; then
  existing=""
  [ -f "$CHROME/userChrome.css" ] && existing="$(strip_block "$CHROME/userChrome.css" "$MARK" "$MARK_END")"
  { [ -n "$existing" ] && printf '%s\n' "$existing"; printf '%s\n' "$MARK"; cat "$ROOT/fallback/userChrome.css"; printf '%s\n' "$MARK_END"; } > "$CHROME/userChrome.css.new"
  mv "$CHROME/userChrome.css.new" "$CHROME/userChrome.css"
  echo "Installed the CSS-only fallback into $CHROME/userChrome.css"
  echo "Set toolkit.legacyUserProfileCustomizations.stylesheets = true in about:config and restart Firefox."
  echo "See fallback/user.js for the prefs that switch the CSS-only features on."
  exit 0
fi

[ -n "$FX" ] || { echo "Missing --firefox <firefox app dir>." >&2; exit 2; }
[ -d "$FX" ] || { echo "Firefox folder not found: $FX" >&2; exit 1; }

rm -rf "$CHROME/vivaldifox"
cp -R "$ROOT/profile/chrome/vivaldifox" "$CHROME/vivaldifox"
echo "Installed the mod into $CHROME/vivaldifox"

PREFDIR="$FX/defaults/pref"
if ! mkdir -p "$PREFDIR" 2>/dev/null || ! touch "$PREFDIR/.vfx-write-test" 2>/dev/null; then
  echo "No write access to $FX. Re-run with sudo (the profile part is already installed)." >&2
  exit 1
fi
rm -f "$PREFDIR/.vfx-write-test"

CFG_NAME="config.js" HAS_AUTOCONFIG=0 HAS_SANDBOX_OFF=0
for f in "$PREFDIR"/*.js; do
  [ -f "$f" ] || continue
  n="$(sed -n 's/.*pref([[:space:]]*"general\.config\.filename"[[:space:]]*,[[:space:]]*"\([^"]*\)".*/\1/p' "$f" | head -n1)"
  if [ -n "$n" ]; then CFG_NAME="$n"; HAS_AUTOCONFIG=1; fi
  if grep -Eq 'pref\([[:space:]]*"general\.config\.sandbox_enabled"[[:space:]]*,[[:space:]]*false' "$f"; then HAS_SANDBOX_OFF=1; fi
done
CFG="$FX/$CFG_NAME"

if [ -f "$CFG" ]; then
  if grep -qF "$BEGIN" "$CFG"; then
    strip_block "$CFG" "$BEGIN" "$END" > "$CFG.tmp"
  else
    cp "$CFG" "$CFG.vivaldifox-backup"
    echo "Existing $CFG_NAME found (another loader). Backup: $CFG_NAME.vivaldifox-backup"
    cp "$CFG" "$CFG.tmp"
  fi
  { cat "$CFG.tmp"; echo; tail -n +2 "$ROOT/install/config.js"; } > "$CFG.new"
  mv "$CFG.new" "$CFG"; rm -f "$CFG.tmp"
  echo "Merged the VivaldiFox hook into $CFG"
else
  cp "$ROOT/install/config.js" "$CFG"
  echo "Installed $CFG"
fi
if [ "$HAS_AUTOCONFIG" = 0 ]; then
  cp "$ROOT/install/config-prefs.js" "$PREFDIR/config-prefs.js"
  echo "Installed defaults/pref/config-prefs.js"
elif [ "$HAS_SANDBOX_OFF" = 0 ]; then
  printf '// VivaldiFox: privileged loader code needs the autoconfig sandbox off.\npref("general.config.sandbox_enabled", false);\n' > "$PREFDIR/vivaldifox-prefs.js"
  echo "Added defaults/pref/vivaldifox-prefs.js (autoconfig sandbox off)"
fi

clear_cache
echo
echo "Done. Restart Firefox, then open Tools > VivaldiFox Settings (all features start switched off)."
