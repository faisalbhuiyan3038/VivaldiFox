# VivaldiFox

Vivaldi's features for Firefox, as 48 independent toggles.

![VivaldiFox: two-level tab stacks, side panel with notes, accent colour, status bar](docs/screenshot.png)

- **Independent.** Every feature has its own switch and none needs another. All are off after installation.
- **Live.** Toggling a feature takes effect immediately, with no restart, and turning it off removes everything it added.
- **Failure-isolated.** A feature that breaks on a future Firefox is switched off and reported in the settings page; the other features and the browser carry on.
- **Tested.** 53 automated cases run inside real Firefox **159.0.1** and Nightly **162.0a1**, each feature alone and all together. See [docs/TEST-REPORT.md](docs/TEST-REPORT.md).

> **Security note.** Most features need privileged browser code, loaded through Firefox's autoconfig mechanism (the same one used by fx-autoconfig and enterprise deployments). That code runs with full browser privileges. Read it before you install it, as you would any userChrome script. A [CSS-only mode](#css-only-mode) with no privileged code is included for a small subset.

## Contents

- [Install](#install) · [Update](#update) · [Uninstall](#uninstall) · [CSS-only mode](#css-only-mode)
- [Configure](#configure)
- [Features](#features) · [Native equivalents](#already-native-in-firefox) · [Not included](#not-included)
- [Commands and maps](#commands-and-maps)
- [Update resilience and known fragility](#update-resilience-and-known-fragility)
- [Trade-offs: stability versus fidelity](#trade-offs-stability-versus-fidelity)
- [Architecture](#architecture) · [Testing](#testing) · [Credits and licences](#credits-and-licences)

## Install

Two things are installed:

| What | Where | Needs admin |
|---|---|---|
| The mod | `<profile>/chrome/vivaldifox/` | no |
| A 20-line autoconfig hook | `<firefox>/config.js` and `<firefox>/defaults/pref/` | yes, if Firefox is under Program Files or `/usr` |

The hook only tells Firefox to load the mod from your profile. It never changes between mod versions.

**If you already use another loader** (fx-autoconfig, Sine, an enterprise config): the installer detects it, backs up its `config.js`, and appends the VivaldiFox block between marker comments. Nothing is overwritten.

### Windows (stable or Nightly)

Close Firefox, then in PowerShell:

```powershell
cd install
.\install.ps1 -ListProfiles                       # find your profile folder
.\install.ps1 -ProfileDir "<profile folder>"      # Firefox stable in Program Files
.\install.ps1 -ProfileDir "<profile folder>" -FirefoxDir "C:\Program Files\Firefox Nightly"
```

Run PowerShell as Administrator if Firefox lives under Program Files. `about:profiles` shows which profile is in use.

### Linux and macOS

```bash
install/install.sh --firefox /usr/lib/firefox --profile ~/.mozilla/firefox/xxxx.default-release
install/install.sh --firefox /Applications/Firefox.app/Contents/Resources --profile ~/Library/Application\ Support/Firefox/Profiles/xxxx.default-release
```

`--firefox` is the folder that contains the Firefox binary's resources (the one with `defaults/` in it). Use `sudo` if it is not writable. Flatpak and Snap builds have a read-only application folder: use CSS-only mode or a tarball build.

### By hand

1. Copy `profile/chrome/vivaldifox/` to `<profile>/chrome/vivaldifox/`.
2. Copy `install/config.js` to the Firefox application folder.
3. Copy `install/config-prefs.js` to `<firefox>/defaults/pref/`.
4. Delete `<profile>/startupCache` (and the same folder under the local/cache profile path), then start Firefox.

### First run

Open **Tools → VivaldiFox Settings** (press Alt to show the menu bar), or load `chrome://vivaldifox/content/options/options.html`. Switch on what you want.

### Required prefs

None that you must set yourself. The hook sets `general.config.filename`, `general.config.obscure_value` and `general.config.sandbox_enabled` for the loader. Features that are native Firefox prefs set them on the *default branch* while enabled, so nothing is written to your `prefs.js` and any value you set yourself wins.

## Update

- **The mod:** run the installer again. It replaces `<profile>/chrome/vivaldifox/` and leaves your data and prefs alone.
- **Firefox:** normal updates keep `config.js`. If a Firefox update or reinstall removes it (some installers do), every feature silently stops; run the installer again.

## Uninstall

```powershell
.\install.ps1 -ProfileDir "<profile folder>" -Uninstall
```
```bash
install/install.sh --firefox <dir> --profile <dir> --uninstall
```

This removes the mod and its block from `config.js` (another loader's code in the same file is kept). Your notes, sessions and workspaces stay in `<profile>/vivaldifox-data/`; delete that folder and reset the `vivaldifox.*` prefs in `about:config` for a complete removal. Speed Dial and Reading List items are ordinary bookmarks and stay too.

## CSS-only mode

For when you do not want privileged code, or a future Firefox has broken the loader:

```powershell
.\install.ps1 -ProfileDir "<profile folder>" -CssOnly
```

This adds a marked section to `<profile>/chrome/userChrome.css`. Set `toolkit.legacyUserProfileCustomizations.stylesheets = true`, restart, then create the boolean prefs you want (see [`fallback/user.js`](fallback/user.js)):

| Pref | Effect |
|---|---|
| `vivaldifox.tabs.appearance.enabled` | tab close button only on hover |
| `vivaldifox.look.rounding.enabled` | rounded corners (radius set in the CSS file) |
| `vivaldifox.look.autohide.enabled` | toolbars hide and return on hover |

These still toggle live and independently. `fallback/user.js` also lists the plain Firefox prefs behind the pref-only features (tab cycler, hover previews, per-tab zoom, vertical tabs and so on). Everything else needs the loader. If both are installed, the fallback rules switch themselves off.

## Configure

| Where | What |
|---|---|
| **Tools → VivaldiFox Settings** | every toggle and option, live status, error messages, command reference |
| `about:config` | the same prefs, under `vivaldifox.` |
| `user.js` | the same prefs, for scripted setups |

- **Master switch:** `vivaldifox.enabled` (default `true`). Off stops everything; on restores exactly what you had chosen.
- **Feature switch:** `vivaldifox.<id>.enabled` (default `false`).
- **Feature option:** `vivaldifox.<id>.<option>`.
- **Side panel (shared by all panel features):** `vivaldifox.panels.side` (`left`/`right`), `vivaldifox.panels.width`, `vivaldifox.panels.autohide` (bar slides in at the window edge), `vivaldifox.panels.hidden` (bar switched off; commands `panels.toggleBar` and `panels.toggleAutohide`).
- Firefox **safe mode** (Troubleshoot Mode) disables the whole mod.

Options that hold maps or lists are JSON. The settings page validates them and refuses to save invalid JSON; a broken value typed into `about:config` is ignored in favour of the default.

## Features

"Approach" tells you how durable a feature is likely to be: **Pref** (a Firefox pref, nothing to break), **CSS**, **JS** (privileged script), **Content** (also needs the [content bridge](#the-content-bridge)).

### Tabs

| Toggle `vivaldifox.…` | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `tabs.cycler` | Ctrl+Tab in recent-use order with previews | Pref | – | – |
| `tabs.hoverPreview` | Thumbnail when hovering a tab | Pref | – | – |
| `tabs.hibernate` | "Hibernate Background Tabs" in the tab menu, plus a command | JS on native unload | `skipPinned` | Tabs playing audio are skipped |
| `tabs.periodicReload` | Reload a tab every 1 min – 1 h (tab menu) | JS | – | Per session; not restored after restart |
| `tabs.trash` | Toolbar button listing closed tabs and windows | JS | `maxItems` | – |
| `tabs.clickBehaviors` | Double-click closes; wheel switches tabs; click active tab → previous tab | Pref + JS | `doubleClickClose`, `wheelSwitch`, `activeToPrevious` | – |
| `tabs.rename` | Custom tab title, kept across navigation and restart | JS | – | Uses one internal tabbrowser method, with a fallback |
| `tabs.muteOthers` | "Mute Other Tabs"; optional audio only in the active tab | JS | `activeOnly` | – |
| `tabs.appearance` | Close-button placement, unread dot, bold active title, minimum width; Arc-inspired restyle of native vertical tabs (rounded rows, raised selected tab, pinned-tab tile grid, page as a rounded inset card) | CSS + JS | `closeButton` (`default`/`hover`/`left`/`hidden`), `unreadIndicator`, `activeBold`, `minWidth`, `verticalStyle` (`arc`/`compact`/`default`), `floatingPage`, `favoritesGrid` | Vertical styling relies on Firefox's vertical-tab element ids |
| `tabs.position` | Tab bar at the bottom, left or right | Pref (left/right), JS + CSS (bottom) | `position` | See note 1 |
| `tabs.sidebarAutohide` | Arc-style auto-hide for native vertical tabs: **hidden** (slides in from the window edge as a floating card) or **strip** (icons stay; hovering expands it over the page). Ctrl+Alt+S or the sidebar button pins / unpins; Esc dismisses a peek; a brief peek on keyboard tab switches | JS + core CSS | `mode`, `pinned`, `key`, `revealDelay`, `hideDelay`, `peekOnSwitch` | Replaces Firefox's own expand-on-hover while on (restored when off; your `sidebar.visibility` is not changed). Uses `SidebarController`'s launcher state |
| `tabs.tiling` | Tile two tabs side by side: command, button, tab-menu item | JS on native Split View | – | Two tabs only; no grids |
| `tabs.workspaces` | Named sets of tabs; only the active set is shown. Tab groups stay in their workspace. Scroll over the workspace button (or swipe horizontally over vertical tabs) to switch | JS | `wheelSwitch`, `swipeSwitch` | See note 2 |
| `tabs.sessions` | Save the open tabs under a name; reopen here or in a new window | JS | – | Saves address, title, pinned state; not per-tab history |
| `tabs.twoLevel` | Tab stacks: a second row lists the tabs of the active stack | JS + CSS on native tab groups | `collapseStacks` | See note 3 |

1. *Bottom:* the tab bar stops being the title bar, so the window controls move to the navigation bar. If you also enable `nav.bottom`, no bar is left at the top and the controls end up at the bottom right; tick **Title Bar** in Firefox's Customize mode for that combination. *Left/right* is Firefox's own vertical-tabs mode and also moves Firefox's sidebar to that side.
2. Tabs are only hidden and shown, never closed or moved. Pinned tabs are shared by all workspaces. The active workspace is per window. Hidden tabs still appear under "hidden tabs" in Firefox's *List all tabs* menu. Turning the feature off shows every tab again.
3. A stack is a native Firefox tab group (create one with *Add tab to new group* in the tab menu). Horizontal tabs only; with vertical tabs the second row is hidden. This is the most version-sensitive feature.

### Address bar and navigation

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `nav.fastForward` | Fast Forward (next page of a series) and Rewind (first page visited on the site) | JS + Content | `guessUrl` | Next-page detection is heuristic: `rel=next`, then "Next"-like links, then numbered URLs |
| `nav.qr` | QR code of the current address | JS | – | – |
| `nav.progress` | Load progress painted in the address field (an estimate: see the header of its `main.sys.mjs`) | JS + CSS | `style` (`fill`/`line`), `color` (`accent`/`custom`/`rainbow`/`page`), `customColor`, `opacity` | – |
| `nav.bottom` | Address bar below the page; results open upwards | JS + CSS | – | Layout-sensitive; see fragility table |

### Page

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `page.actions` | Per-tab filters: grayscale, sepia, invert, contrast, dim, obscure, monospace, hide images, no animations, outlines, unstick | JS + Content | – | Per tab and per session |
| `page.breakMode` | Pause all media and cover the browser | JS | – | Only media Firefox reports as playing is paused |
| `page.imageToggle` | Images: all / no third-party / none | JS on a native pref | `reloadOnChange` | Global, not per tab. No "cached images only" mode exists in Firefox |
| `zoom.perTab` | Zoom applies to the tab, not the whole site | Pref | – | – |
| `capture` | Full page or visible area to file or clipboard; area selection | JS + Content | `format` (`png`/`jpg`), `folder` | Area selection hands over to Firefox Screenshots |

### Status bar

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `statusbar` | A real customizable toolbar at the bottom; drag any button in | JS + CSS | `compact` | Hidden in fullscreen |
| `statusbar.linkText` | Hovered-link/status text as a toolbar item | JS | – | Place it yourself if the status bar is off (it starts in the Customize palette) |
| `widgets.zoom` | Zoom slider | JS | – | – |
| `widgets.clock` | Clock with countdown timer | JS | `hour24`, `seconds`, `date` | Timer end flashes the clock; a system notification is attempted |

The widgets are ordinary toolbar items. They start in the status bar when it is on, otherwise in the navigation bar, and can be dragged anywhere. Switching the status bar off moves its items to the navigation bar.

### Panels

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `panels.notes` | Markdown notes; "Add Selection as Note" in the page menu | JS | – | Markdown subset: headings, lists, bold, italic, code, links |
| `panels.downloads` | Downloads list | JS on the public Downloads API | – | – |
| `panels.readingList` | Read-later list | JS on bookmarks | – | Items are bookmarks in a "Reading List" folder (so they sync); read state is local |
| `panels.web` | Any site pinned as a panel, mobile layout by default | JS | `sites` | See note 4 |
| `panels.floating` | The open panel overlays the page instead of narrowing it | CSS | – | – |

4. Each web panel is a real sandboxed content browser, like a tab, so sites that forbid framing work. It is not a tab, though: whether your extensions (content blockers, password managers) act inside web panels was not verified.

The panel strip appears only while at least one panel feature is on. It is the mod's own panel host, separate from Firefox's sidebar, which keeps working alongside it.

### Start page

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `startpage` | New-tab (and optionally home) page with Speed Dial, Bookmarks, History | JS | `setHome`, `columns`, `thumbnails`, `background`, `backgroundDim`, `historyItems` | Thumbnails come from Firefox's thumbnail cache and are best-effort |

Speed Dial tiles are bookmarks in a bookmarks folder named **Speed Dial**; its subfolders become groups. While that folder is empty the page shows your most visited sites. A **Notes** section appears while `panels.notes` is on.

### Input and commands

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `input.gestures` | Mouse gestures with the right button, with a trail | JS | `map`, `trail` | Works on every page, including `about:` pages |
| `input.rocker` | Hold right + click left = back; hold left + click right = forward | JS | `rightThenLeft`, `leftThenRight` | – |
| `quickCommands` | F2 palette: commands (with shortcuts), tabs in all windows and workspaces, closed tabs, bookmarks, history, search-engine keywords, settings pages, workspaces, feature toggles, calculator | JS | `key`, `maxResults` | – |
| `input.shortcuts` | Any key combination → any command | JS | `map` | Does not show in Firefox's own shortcut list |
| `input.singleKey` | One-key shortcuts when not typing (1/2 tabs, Z/X history) | JS | `map` | – |
| `input.chains` | Sequences of commands with waits and URLs | JS | `chains` | A chain cannot call another chain |
| `input.spatialNav` | Shift+Arrow moves focus to the nearest link | Content | – | Geometric heuristic; not inside cross-site iframes |
| `input.selectionSearch` | "Search for …" opens in a background tab | Pref | – | – |

Gestures and rocker gestures make context menus open on mouse-up on every platform (`ui.context_menus.after_mouseup`), which is already the Windows behaviour.

### Look and feel

| Toggle | What it does | Approach | Options | Limits |
|---|---|---|---|---|
| `look.accent` | Tab bar takes the page's colour | JS + CSS (+ Content) | `themeColor`, `favicon`, `strength` | Without the content bridge only the favicon colour is used |
| `look.themeSchedule` | Light theme by day, dark by night | JS on the public AddonManager | `lightTheme`, `darkTheme`, `lightStart`, `darkStart` | Time-based only; themes are named by add-on id |
| `look.rounding` | One corner radius for tabs, fields, buttons, popups | CSS | `radius` | – |
| `look.uiZoom` | Zoom the interface without zooming pages; extension popups get the same zoom so they are sized correctly | JS | `percent` | – |
| `look.background` | Image behind the whole window frame (toolbars, tab bar, vertical tabs, panels, status bar) | CSS | `image`, `toolbarOpacity`, `tabbarOpacity`, `fieldOpacity` | With `look.accent` on, the accent tints the tab bar over the image |
| `look.autohide` | Ctrl+F11 hides all toolbars, and vertical tabs too; optional reveal on hover (toolbars at the top edge, the sidebar at its own edge) | JS + CSS | `key`, `revealOnHover`, `startHidden` | Toolbars stay visible while the address bar has focus |
| `look.menuButton` | One button opening the classic File/Edit/View menus | JS | – | Not useful on macOS, where the menu bar is the system's |

### Already native in Firefox

These Vivaldi features need no mod code; they are listed so you know where to find them.

| Vivaldi feature | In Firefox |
|---|---|
| Windows/tabs tree panel | Vertical tabs (`tabs.position` = left) or the Sidebery extension |
| Bookmarks, History, Synced Tabs panels | Firefox sidebar |
| Search-engine nicknames, paste-and-go, reader view | Built in |
| Pop-out video | Picture-in-Picture |
| Toolbar editor | Customize mode |
| UI density | `browser.uidensity` |

### Not included

Mail, calendar and feed reader; sync; VPN; ad blocker; translate panel; dashboard widgets; tiling of three or more tabs; automatic stacking by host. These were excluded by design when the scope was fixed.

## Commands and maps

Gestures, shortcuts, single-key shortcuts, chains and Quick Commands all use one command registry. It always contains about 90 Firefox commands (`back`, `newTab`, `reopenTab`, `zoomIn`, `fullscreen` …). Each running feature adds its own (`tabs.hibernateBackground`, `capture.fullFile`, `panels.notes`, `workspaces.next`, `look.toggleUI` …). The settings page lists every command currently available.

A map that names a command whose feature is off is not an error: that entry is skipped and the key or gesture keeps its normal Firefox behaviour.

```jsonc
// vivaldifox.input.gestures.map : strokes are U/D/L/R sequences
{ "L": "back", "R": "forward", "D": "newTab", "DR": "closeTab", "UD": "reload" }

// vivaldifox.input.shortcuts.map : modifiers Ctrl, Alt, Shift, Meta in any order
{ "Ctrl+Shift+H": "tabs.hibernateBackground", "F4": "panels.toggle", "Ctrl+Shift+B": "none" }

// vivaldifox.input.chains.chains
[{ "id": "research", "label": "Research mode",
   "steps": ["tabs.muteOthers", { "open": "https://en.wikipedia.org", "background": true }, { "wait": 300 }, "panels.notes"] }]
```

## Update resilience and known fragility

Design rules followed throughout:

- **Native first.** Where Firefox has the feature, the mod sets a pref or calls the public method and adds only the Vivaldi-style surface.
- **No module URLs.** Firefox's modules are fetched from the browser window's long-lived globals (`SessionStore`, `CustomizableUI`, `PlacesUtils` …), with URL lists only as fallback. This was needed already during development: 159 had moved two modules that older scripts import by path.
- **Own elements over patched elements.** The status bar, panel host, quick-command palette and stack row are the mod's own nodes attached to one durable container each. Only two selectors are structural: `#browser` and `#navigator-toolbox`.
- **No key or menu rewriting.** Shortcuts are a capturing listener, not edits to Firefox's `<key>` elements. Menu items are appended, and a missing menu is a silent no-op.
- **Everything undoable.** Each feature registers its changes on a scope; disabling runs the undo stack. Tests assert that nothing is left behind.
- **Fail closed, per feature.** Any exception while starting a feature rolls that feature back and shows the error in the settings page.

Known weak points, most fragile first:

| Area | Features affected | What could break it | What happens then | Fallback |
|---|---|---|---|---|
| <a id="the-content-bridge"></a>**Content bridge** (frame scripts) | `nav.fastForward`, `page.actions`, `capture`, `input.spatialNav`, `look.accent` | Mozilla retires the message-manager frame-script API. Firefox 159 already refuses runtime-registered JSWindowActors in web processes, which is why actors are not used | Those features stop reaching the page | The transport is isolated in `core/content.sys.mjs`; only that file needs replacing. Fast Forward still works by URL guessing, accent colour by favicon |
| **Tab groups** | `tabs.twoLevel` | Changes to `tab.group`, `group.tabs`, `group.collapsed` or the `TabGroup*` events | The feature reports failure or the second row stops updating | Native tab groups keep working without it |
| **Address-bar internals** | `nav.bottom` | The results list stops being an anchored child of `#urlbar` | Results open downwards and are clipped | Rules for the older "breakout" layout are kept alongside; disable the feature |
| **Toolbar relocation** | `tabs.position` (bottom), `nav.bottom` | CustomizableUI stops tolerating toolbars outside the toolbox, or the nav bar loses its spare window-control box | Window controls missing in bottom-tabs mode | Use left/right (native) or Firefox's Title Bar option |
| **Split View** | `tabs.tiling` | `gBrowser.addTabSplitView` is renamed | Clear error in settings | Firefox's own Split View menu |
| **New-tab override** | `startpage` | `AboutNewTab.newTabURL` is removed | Feature reports failure; Firefox's new tab stays | Open the start page by command or bookmark its URL |
| **Autoconfig itself** | everything except CSS-only mode | Mozilla removes unsandboxed autoconfig from release builds | Nothing loads | CSS-only mode; pref-only features via `fallback/user.js` |
| **Tab internals** | `tabs.rename` | `gBrowser._setTabLabel` removed | Falls back to setting the label attribute | – |
| **CSS class names** | `tabs.appearance`, `look.rounding`, `nav.progress` | `.tab-close-button`, `.tab-background`, `.urlbar-background` renamed | That visual tweak silently stops | Tests check these classes still exist |

## Trade-offs: stability versus fidelity

| Choice made | Gain | Cost against Vivaldi |
|---|---|---|
| Vertical tabs, tiling, stacks and capture build on Firefox's own features | They survive updates and inherit Firefox's fixes | They look and behave like Firefox: two-tab tiling only, native group styling |
| The side panel is the mod's own host, not Firefox's sidebar | Independent of a sidebar that was rewritten twice recently | Two panel systems exist side by side; Firefox's bookmarks/history sidebar is not in the mod's strip |
| Workspaces only hide and show tabs | No way to lose a tab | No per-workspace pinned tabs or icons |
| Speed Dial and Reading List are plain bookmarks | Syncs, and survives removing the mod | No custom thumbnails or drag-to-reorder on the page |
| Shortcuts are a key listener | Immune to Firefox renaming its keys | Not visible in Firefox's own shortcut UI |
| Page Actions and Image Toggle use what Firefox offers | Small, durable code | Image blocking is global; no "cached only" |
| Sessions store addresses only | Simple, readable JSON | No scroll position or history per tab |

## Architecture

```
install/                 config.js + config-prefs.js (the hook), install.ps1, install.sh
fallback/                userChrome.css + user.js for CSS-only mode
profile/chrome/vivaldifox/
  chrome.manifest        registers chrome://vivaldifox/content/
  boot.sys.mjs           loader: default prefs, per-feature start/stop, failure isolation
  features.sys.mjs       the registry: one declarative entry per feature
  core/                  shared infrastructure, always present, forces nothing on
    scope.sys.mjs          undo stack behind every feature
    fx.sys.mjs             resilient access to Firefox modules
    commands.sys.mjs       command registry
    keys.sys.mjs           key-combo engine
    pointer.sys.mjs        context-menu suppression for gestures
    content.sys.mjs        the content bridge
    panels.sys.mjs/.css    side-panel host
    sidebarPeek.sys.mjs/.css  auto-hide engine for the vertical-tabs sidebar (transform / clip-path, no reflow)
    relocate.sys.mjs       order-independent toolbar relocation
    store.sys.mjs          JSON files in <profile>/vivaldifox-data/
    ui.sys.mjs, toast.sys.mjs
  features/<id>/         main.sys.mjs, style.css, content.js — whichever the feature needs
  options/               the settings page
  vendor/qrcode.js       third-party (MIT)
test/                    Marionette harness, runner, one case file per feature
docs/                    test report, raw results, screenshot
```

A feature is a registry entry plus up to three files:

```js
// features.sys.mjs
{ id: "my.feature", cat: "Tabs", title: "…", desc: "…", module: true, css: true,
  native: { "some.firefox.pref": true },                 // optional
  options: { speed: { type: "int", default: 3, label: "…" } } }

// features/my.feature/main.sys.mjs
export default {
  start(scope, ctx) { /* once: commands, widgets, global state */ },
  window(win, scope, ctx) { /* per browser window */ },
};
```

Register everything on `scope` (`scope.listen`, `scope.node`, `scope.attr`, `scope.nativePref`, `scope.add(fn)`) and there is no teardown code to write. `ctx.opt("speed")` reads an option; changing an option restarts the feature unless the option is marked `live`.

Shared infrastructure is allowed only when it is inert on its own. The panel host, for example, creates no DOM until some panel feature registers a panel.

## Testing

```bash
node test/fx.mjs setup stable        # once: copies your installed Firefox into .test/fx-stable (or: --from <folder>)
node test/fx.mjs start stable        # or: nightly. Launches a private Firefox copy with a clean profile
node test/run.mjs                    # each feature alone
node test/run.mjs --all-on           # everything enabled together
node test/run.mjs tabs.workspaces    # selected cases
node test/fx.mjs stop
```

`setup` copies an installed Firefox into `.test/fx-<channel>` (git-ignored, about 0.5 GB); the copy receives the autoconfig hook, so the harness never touches your real installation or profile. Cases can drive real pointer input (`mouseAt`, `hover`, which go through the same EventUtils code as WebDriver actions, without moving your cursor), and load files from `test/fixtures/` (e.g. a probe extension for popup sizing). For each case the runner enables only that feature, checks it reports running, drives it inside the browser, disables it, and then asserts that no `vfx-*` node, root attribute, CSS variable or window property remains and that the mod logged no console error.

## Credits and licences

VivaldiFox is licensed under the [Mozilla Public License 2.0](LICENSE).

| Source | Licence | Use |
|---|---|---|
| [MrOtherGuy/fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) | MPL-2.0 | The profile-manifest loading pattern in `install/config.js` |
| [MrOtherGuy/firefox-csshacks](https://github.com/MrOtherGuy/firefox-csshacks) | MPL-2.0 | The transform-and-negative-margin technique in `look.autohide` |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | MIT | Vendored unmodified as `vendor/qrcode.js` |
| Floorp, Zen Browser | MPL-2.0 | Concept reference for web panels and workspaces; no code copied |
| Adaptive Tab Bar Colour, Gesturefy, Vimium | MIT / GPL-3.0 / MIT | Concept reference only; no code copied |

Vivaldi is a trademark of Vivaldi Technologies. This project is not affiliated with Vivaldi or Mozilla.
