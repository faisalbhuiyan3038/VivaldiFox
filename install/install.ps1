<#
.SYNOPSIS
  Install, update or remove VivaldiFox (Windows).

.DESCRIPTION
  Two things get installed:
    1. The mod itself        -> <profile>\chrome\vivaldifox\        (no admin needed)
    2. A tiny autoconfig hook -> <firefox>\config.js + defaults\pref (admin needed under Program Files)

  The hook is merged, never overwritten: if another loader (fx-autoconfig,
  Sine, an enterprise config...) already owns config.js, the VivaldiFox block
  is appended between marker comments and a backup is kept.

.EXAMPLE
  .\install.ps1 -ListProfiles
  .\install.ps1 -ProfileDir "$env:APPDATA\Mozilla\Firefox\Profiles\abcd1234.default-release"
  .\install.ps1 -FirefoxDir "C:\Program Files\Firefox Nightly" -ProfileDir <path>
  .\install.ps1 -ProfileDir <path> -CssOnly      # no privileged JS: userChrome.css fallback only
  .\install.ps1 -ProfileDir <path> -Uninstall
#>
[CmdletBinding()]
param(
  [string]$FirefoxDir = "$env:ProgramFiles\Mozilla Firefox",
  [string]$ProfileDir,
  [switch]$ListProfiles,
  [switch]$CssOnly,
  [switch]$Uninstall
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Begin = "// >>> vivaldifox-begin"
$End = "// <<< vivaldifox-end"

function Get-Profiles {
  $base = "$env:APPDATA\Mozilla\Firefox"
  $ini = Join-Path $base "profiles.ini"
  if (-not (Test-Path $ini)) { return @() }
  $out = @(); $cur = @{}
  foreach ($line in (Get-Content $ini) + "[end]") {
    if ($line -match '^\[') {
      if ($cur.Path) {
        $p = if ($cur.IsRelative -eq "1") { Join-Path $base ($cur.Path -replace '/', '\') } else { $cur.Path }
        $out += [pscustomobject]@{ Name = $cur.Name; Path = $p }
      }
      $cur = @{}
    } elseif ($line -match '^(\w+)=(.*)$') { $cur[$Matches[1]] = $Matches[2] }
  }
  return $out
}

if ($ListProfiles -or -not $ProfileDir) {
  Write-Host "Firefox profiles (pass one as -ProfileDir; about:profiles shows which one is in use):"
  Get-Profiles | ForEach-Object { Write-Host ("  {0,-28} {1}" -f $_.Name, $_.Path) }
  if (-not $ListProfiles) { Write-Host "`nNo -ProfileDir given: nothing was changed." }
  return
}
if (-not (Test-Path $ProfileDir)) { throw "Profile folder not found: $ProfileDir" }

$chrome = Join-Path $ProfileDir "chrome"
$modDst = Join-Path $chrome "vivaldifox"
$fallbackCss = Join-Path $chrome "userChrome.css"
$fallbackMark = "/* vivaldifox-fallback */"

function Get-BlockPattern { return "(?s)\r?\n?" + [regex]::Escape($Begin) + ".*?" + [regex]::Escape($End) + "\r?\n?" }

function Remove-Hook {
  $cfgs = @()
  $prefDir = Join-Path $FirefoxDir "defaults\pref"
  if (Test-Path $FirefoxDir) { $cfgs = Get-ChildItem $FirefoxDir -Filter "*.js" -File | Where-Object { (Get-Content $_.FullName -Raw) -match [regex]::Escape($Begin) } }
  foreach ($f in $cfgs) {
    $text = (Get-Content $f.FullName -Raw) -replace (Get-BlockPattern), "`n"
    # If only the mandatory first-line comment is left, the file was ours alone.
    if (($text -replace '(?m)^\s*//.*$', '').Trim() -eq "") {
      Remove-Item $f.FullName -Confirm:$false
      $ours = Join-Path $prefDir "config-prefs.js"
      if ((Test-Path $ours) -and ((Get-Content $ours -Raw) -match "VivaldiFox autoconfig bootstrap")) { Remove-Item $ours -Confirm:$false }
      Write-Host "Removed $($f.Name) (it contained only the VivaldiFox hook)."
    } else {
      Set-Content -Path $f.FullName -Value $text.TrimEnd() -Encoding utf8
      Write-Host "Removed the VivaldiFox block from $($f.Name); the other loader in it is untouched."
    }
  }
  $extra = Join-Path $prefDir "vivaldifox-prefs.js"
  if (Test-Path $extra) { Remove-Item $extra -Confirm:$false }
}

function Clear-StartupCache {
  # Firefox caches autoconfig and chrome scripts; drop the cache so changes load.
  $name = Split-Path $ProfileDir -Leaf
  foreach ($c in @((Join-Path $ProfileDir "startupCache"), "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles\$name\startupCache")) {
    if (Test-Path $c) { Remove-Item $c -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue }
  }
}

if ($Uninstall) {
  if (Test-Path $modDst) { Remove-Item $modDst -Recurse -Force -Confirm:$false; Write-Host "Removed $modDst" }
  if ((Test-Path $fallbackCss) -and ((Get-Content $fallbackCss -Raw) -match [regex]::Escape($fallbackMark))) {
    $text = (Get-Content $fallbackCss -Raw) -replace ("(?s)" + [regex]::Escape($fallbackMark) + ".*?/\* vivaldifox-fallback-end \*/\r?\n?"), ""
    if ($text.Trim()) { Set-Content $fallbackCss $text -Encoding utf8 } else { Remove-Item $fallbackCss -Confirm:$false }
    Write-Host "Removed the VivaldiFox section from userChrome.css"
  }
  try { Remove-Hook } catch { Write-Warning "Could not edit $FirefoxDir (run elevated to remove the hook): $($_.Exception.Message)" }
  Clear-StartupCache
  Write-Host "Uninstalled. Your notes/sessions stay in $ProfileDir\vivaldifox-data; vivaldifox.* prefs can be reset in about:config."
  return
}

New-Item -ItemType Directory -Force $chrome | Out-Null

if ($CssOnly) {
  # CSS-only mode: no privileged code at all. A marked section in userChrome.css.
  $css = Get-Content (Join-Path $Root "fallback\userChrome.css") -Raw
  $section = "$fallbackMark`n$css`n/* vivaldifox-fallback-end */`n"
  $existing = if (Test-Path $fallbackCss) { (Get-Content $fallbackCss -Raw) -replace ("(?s)" + [regex]::Escape($fallbackMark) + ".*?/\* vivaldifox-fallback-end \*/\r?\n?"), "" } else { "" }
  Set-Content $fallbackCss ($existing.TrimEnd() + "`n" + $section).TrimStart() -Encoding utf8
  Write-Host "Installed the CSS-only fallback into $fallbackCss"
  Write-Host "Now set toolkit.legacyUserProfileCustomizations.stylesheets = true in about:config and restart Firefox."
  Write-Host "See fallback\user.js for the prefs that switch the CSS-only features on."
  return
}

# 1. The mod (profile).
if (Test-Path $modDst) { Remove-Item $modDst -Recurse -Force -Confirm:$false }
Copy-Item (Join-Path $Root "profile\chrome\vivaldifox") $modDst -Recurse
Write-Host "Installed the mod into $modDst"

# 2. The autoconfig hook (Firefox folder).
if (-not (Test-Path (Join-Path $FirefoxDir "firefox.exe"))) { throw "firefox.exe not found in $FirefoxDir (use -FirefoxDir)" }
$prefDir = Join-Path $FirefoxDir "defaults\pref"
try {
  New-Item -ItemType Directory -Force $prefDir | Out-Null
  $probe = Join-Path $prefDir ".vfx-write-test"; Set-Content $probe "x"; Remove-Item $probe -Confirm:$false
} catch {
  throw "No write access to $FirefoxDir. Re-run this script from an elevated (Administrator) PowerShell. The profile part is already installed."
}

# Is some other autoconfig already set up? Respect its file name.
$cfgName = "config.js"; $hasAutoconfig = $false; $hasSandboxOff = $false
foreach ($f in Get-ChildItem $prefDir -Filter "*.js" -File) {
  $t = Get-Content $f.FullName -Raw
  if ($t -match 'pref\(\s*"general\.config\.filename"\s*,\s*"([^"]+)"') { $cfgName = $Matches[1]; $hasAutoconfig = $true }
  if ($t -match 'pref\(\s*"general\.config\.sandbox_enabled"\s*,\s*false') { $hasSandboxOff = $true }
}
$cfg = Join-Path $FirefoxDir $cfgName
$ourBlock = ((Get-Content (Join-Path $PSScriptRoot "config.js") -Raw) -split "`r?`n" | Select-Object -Skip 1) -join "`n"

if (Test-Path $cfg) {
  $text = Get-Content $cfg -Raw
  if ($text -match [regex]::Escape($Begin)) {
    $text = $text -replace (Get-BlockPattern), "`n"
  } else {
    Copy-Item $cfg "$cfg.vivaldifox-backup" -Force
    Write-Host "Existing $cfgName found (another loader). Backup: $cfgName.vivaldifox-backup"
  }
  Set-Content -Path $cfg -Value ($text.TrimEnd() + "`n" + $ourBlock.Trim() + "`n") -Encoding utf8
  Write-Host "Merged the VivaldiFox hook into $cfg"
} else {
  Copy-Item (Join-Path $PSScriptRoot "config.js") $cfg
  Write-Host "Installed $cfg"
}
if (-not $hasAutoconfig) {
  Copy-Item (Join-Path $PSScriptRoot "config-prefs.js") (Join-Path $prefDir "config-prefs.js")
  Write-Host "Installed defaults\pref\config-prefs.js"
} elseif (-not $hasSandboxOff) {
  Set-Content (Join-Path $prefDir "vivaldifox-prefs.js") "// VivaldiFox: privileged loader code needs the autoconfig sandbox off.`npref(`"general.config.sandbox_enabled`", false);" -Encoding utf8
  Write-Host "Added defaults\pref\vivaldifox-prefs.js (autoconfig sandbox off)"
}

Clear-StartupCache
Write-Host "`nDone. Restart Firefox, then open Tools > VivaldiFox Settings (all features start switched off)."
