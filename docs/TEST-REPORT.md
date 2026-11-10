# VivaldiFox test report

Date: 2026-11-10 · Platform: Windows 11 Pro (10.0.26200), x64

## Summary

| Build | Mode | Result |
|---|---|---|
| Firefox 159.0.1 (build 20261102144711) | each feature enabled alone | **53/53** |
| Firefox 159.0.1 (build 20261102144711) | all 48 features enabled together | **53/53** |
| Firefox 162.0a1 (build 20261109214446) | each feature enabled alone | **53/53** |
| Firefox 162.0a1 (build 20261109214446) | all 48 features enabled together | **53/53** |

All runs passed.

48 feature toggles are covered by 53 cases: one or more per feature, plus three for the framework (`core.*`) and one for combined layout (`statusbar.combined`).

## How the tests were run

- **Real browser, clean profile.** Private copies of the installed Firefox 159.0.1 and Nightly 162.0a1 were launched with a freshly created profile each time. The user's real installation and profiles were never touched.
- **Real installation path.** The mod was loaded the way a user loads it: `config.js` in the application folder, the mod in `<profile>/chrome/vivaldifox/`. The Nightly copy was installed with `install/install.sh`, a Firefox 159 copy with `install/install.ps1`.
- **Driven from inside.** A Marionette client runs each case in the browser's chrome context, against real tabs loading pages from a local HTTP server.
- **What "PASS" requires**, for every case in the isolated runs:
  1. no other feature is running (independence);
  2. the feature reports `running` with no error after its pref is set;
  3. the behavioural assertions in `test/cases/<id>.js` hold;
  4. after the pref is cleared, no `vfx-*` element, root attribute, `--vfx*` variable or `window.vfx*` property remains, and the feature reports stopped;
  5. the mod logged nothing to the error console.
- **All-on runs** enable every feature first, then run the same cases, and additionally require that no feature has failed to start. They exist to catch features interfering with one another.

## Additional checks (manual, scripted through the same harness)

| Check | Result |
|---|---|
| Cold start with all 48 features enabled and session restore on | 48 running, 0 failed |
| Tab renamed before restart | Custom title present after restart |
| Workspace created before restart | Workspace listed after restart; its tabs restored hidden, default workspace active |
| `install.ps1` into a Firefox copy that already had another autoconfig loader | Hook merged after the foreign code, backup written, sandbox pref added in a separate file; both loaders ran |
| `install.ps1` run twice | Exactly one VivaldiFox block in `config.js` |
| `install.ps1 -Uninstall` | Mod folder removed; `config.js` contained only the foreign loader's original lines again |
| `install.ps1 -CssOnly` (no loader) | `userChrome.css` rules followed `vivaldifox.tabs.appearance.enabled`, `look.rounding.enabled`, `look.autohide.enabled` live |
| `install.sh` fresh install (Nightly copy, under Git Bash) | Loader active on first start |
| Screenshots of the running browser | Four screenshots reviewed by eye; they exposed two defects the assertions had missed (below) |

## Defects found by testing, and their fixes

| Found by | Defect | Fix |
|---|---|---|
| First actor-based case on 159 | Firefox 159 refuses JSWindowActors registered at runtime in web content processes | Replaced with a single frame-script bridge (`core/content.sys.mjs`) |
| First run on 159 | `resource:///modules/CustomizableUI.sys.mjs` and `SessionStore.sys.mjs` no longer exist | Modules are taken from window globals, URL lists only as fallback (`core/fx.sys.mjs`) |
| `tabs.appearance` | Firefox removed the `notselectedsinceload` tab attribute | Unread state is tracked by the feature itself |
| Content-bridge cases | `element.ownerGlobal` is `undefined` in 159 | `ownerDocument.defaultView` everywhere |
| `capture` | `drawSnapshot`'s 4th argument changed type; two captures in one second overwrote each other | Only the three stable arguments are used, captured in strips; unique file names |
| Combined-layout screenshot | Tab bar at the bottom took half the window (`flex="1"` attribute honoured outside the toolbox) | Attribute parked while the bar is relocated; a test now asserts bar and page heights |
| `statusbar.combined` | Restoring relocated toolbars depended on the order features were enabled in | Shared relocation helper restores against the recorded original order |
| All-on run | Restarting `look.themeSchedule` raced with its own theme restore and left the wrong theme active | The new instance waits for the pending restore and re-checks the real theme state |
| `nav.bottom` | Address-bar results are anchor-positioned in 159, so the first CSS flip had no effect | Results re-anchored with `position-area` |
| Screenshot review (all features on) | With `panels.floating`, the page painted over the open panel | Stacking context on the panel host; the test now hit-tests pixels across the panel |

## Not covered

- **Linux and macOS.** No such machine was available. The shell installer ran under Git Bash on Windows only.
- **Physical input devices.** Mouse gestures, rocker gestures and keyboard shortcuts were exercised with events synthesized inside the browser, not with a real mouse or keyboard. Context-menu suppression after a gesture was verified at the event level only.
- **`capture` → Select Area.** It hands over to Firefox Screenshots' interactive overlay; only the hand-over is wired, not driven by a test.
- **System notification at the end of a clock countdown.** The in-toolbar alarm is asserted; the operating-system notification is not.
- **Extensions inside web panels**, and behaviour in private windows.
- **Long-running use.** Each case runs for seconds; there is no soak or memory test.
- **The user's real installation.** Nothing was installed into `C:\Program Files\Mozilla Firefox`.

## Raw results

### Firefox 159.0.1 (build 20261102144711) – each feature enabled alone

| Case | Result | Notes |
|---|---|---|
| `capture` | PASS | full page 1366x3000, visible 1366x683 written as PNG; clipboard has image |
| `core.masterSwitch` | PASS | master switch stops and restores the selected features without touching their own prefs |
| `core.options` | PASS | 48 features listed; toggles and options write prefs live; bad JSON rejected |
| `core.resilience` | PASS | corrupt prefs, unknown/missing commands, new windows and module lookup all degrade safely |
| `input.chains` | PASS | example chain ran its steps in order |
| `input.gestures` | PASS | stroke D recognized over content -> new tab; trail drawn/removed; context menu suppressed |
| `input.rocker` | PASS | rocker back and forward both navigate |
| `input.selectionSearch` | PASS | native pref applied |
| `input.shortcuts` | PASS | combo normalized and ran newTab; unknown/unmapped keys left alone |
| `input.singleKey` | PASS | single key works on page, suppressed in page inputs (IME state) and in the address bar |
| `input.spatialNav` | PASS | focus moved a->b->d->c->a geometrically; text inputs left alone |
| `look.accent` | PASS | theme-color (red) and favicon (green) both tint the tab bar; cleared on blank page |
| `look.autohide` | PASS | toolbars slide away (page top 84px -> ~4px) and return with Ctrl+F11 |
| `look.background` | PASS | image painted on the toolbox; nav bar translucent (color(srgb 0.109804 0.105882 0.133333 / 0.4)) |
| `look.menuButton` | PASS | 8 native menus lent to the button popup and returned intact |
| `look.rounding` | PASS | tabs and address field use the configured 12px radius |
| `look.themeSchedule` | PASS | schedule maths correct; light theme applied by schedule and previous theme restored |
| `look.uiZoom` | PASS | interface at 125% (dpr 1.25), page content unchanged (dpr 1) |
| `nav.bottom` | PASS | nav bar at the bottom; results list opens upwards and stays on screen |
| `nav.fastForward` | PASS | rel=next followed (content bridge works), URL guessing correct, rewind returned to first page |
| `nav.progress` | PASS | progress shown during load and cleared afterwards |
| `nav.qr` | PASS | QR panel rendered (246px), finder pattern present |
| `page.actions` | PASS | grayscale re-applied on navigation (pixel 54,54,54), cleared back to 255,0,0 |
| `page.breakMode` | PASS | overlay covers the window and click resumes |
| `page.imageToggle` | PASS | pref toggled to block, icon updated, original value restored on disable |
| `panels.downloads` | PASS | live download appears, completes and disappears in the panel |
| `panels.floating` | PASS | open panel overlays the page; page width unchanged |
| `panels.notes` | PASS | panel opens beside the page; notes add/edit/persist/delete; markdown safe; selection -> note |
| `panels.readingList` | PASS | page saved as bookmark in 'Reading List', listed, marked read, removed |
| `panels.web` | PASS | site loads in an out-of-process panel browser with mobile UA; list edits apply live |
| `quickCommands` | PASS | F2 opens; finds tabs and commands; Enter runs; Esc closes |
| `startpage` | PASS | new tab + home overridden; tiles from 'Speed Dial' bookmarks with groups; bookmarks/history sections; restored on disable |
| `statusbar` | PASS | bottom toolbar present, accepts Firefox's own buttons |
| `statusbar.combined` | PASS | page > address bar > tab bar > stack row > status bar, regardless of enable order |
| `statusbar.linkText` | PASS | hover text mirrored into the toolbar item; native overlay restored when item is removed |
| `tabs.appearance` | PASS | close buttons hidden; unread dot on background tab |
| `tabs.clickBehaviors` | PASS | native prefs applied; click on active tab returned to previous tab |
| `tabs.cycler` | PASS | native pref overridden on default branch only |
| `tabs.hibernate` | PASS | background tab unloaded, active tab kept |
| `tabs.hoverPreview` | PASS | native prefs applied |
| `tabs.muteOthers` | PASS | other tabs muted, active left alone, unmute restores |
| `tabs.periodicReload` | PASS | tab reloaded on a 1 s interval, then stopped |
| `tabs.position` | PASS | tab bar under the page, window controls moved to nav bar, tabs functional, restored on disable |
| `tabs.position.left` | PASS | native vertical tabs engaged on the left and reverted on disable |
| `tabs.rename` | PASS | custom title set, survives navigation, clears back to page title |
| `tabs.sessions` | PASS | session saved to disk, reopened here and in a new window, deleted |
| `tabs.tiling` | PASS | two tabs tiled side by side via native Split View, then untiled |
| `tabs.trash` | PASS | closed tab listed and restored from the trash menu |
| `tabs.twoLevel` | PASS | second row lists/switches/extends the active stack; stacks stay folded; label click activates |
| `tabs.workspaces` | PASS | create/switch/move/delete workspaces: tabs only hidden and shown, never closed |
| `widgets.clock` | PASS | clock ticks with seconds; 2 s countdown fired the alarm |
| `widgets.zoom` | PASS | slider sets zoom to 150%; label follows reset to 100% |
| `zoom.perTab` | PASS | native pref applied |

**53/53 passed.**

### Firefox 159.0.1 (build 20261102144711) – all features enabled together

| Case | Result | Notes |
|---|---|---|
| `capture` | PASS | full page 1326x3000, visible 1326x657 written as PNG; clipboard has image |
| `core.masterSwitch` | PASS | skipped in all-on mode |
| `core.options` | PASS | skipped in all-on mode |
| `core.resilience` | PASS | skipped in all-on mode |
| `input.chains` | PASS | example chain ran its steps in order |
| `input.gestures` | PASS | stroke D recognized over content -> new tab; trail drawn/removed; context menu suppressed |
| `input.rocker` | PASS | rocker back and forward both navigate |
| `input.selectionSearch` | PASS | native pref applied |
| `input.shortcuts` | PASS | combo normalized and ran newTab; unknown/unmapped keys left alone |
| `input.singleKey` | PASS | single key works on page, suppressed in page inputs (IME state) and in the address bar |
| `input.spatialNav` | PASS | focus moved a->b->d->c->a geometrically; text inputs left alone |
| `look.accent` | PASS | theme-color (red) and favicon (green) both tint the tab bar; cleared on blank page |
| `look.autohide` | PASS | toolbars slide away (page top 0px -> ~4px) and return with Ctrl+F11 |
| `look.background` | PASS | image painted on the toolbox; nav bar translucent (color(srgb 1 1 1 / 0.4)) |
| `look.menuButton` | PASS | 8 native menus lent to the button popup and returned intact |
| `look.rounding` | PASS | tabs and address field use the configured 12px radius |
| `look.themeSchedule` | PASS | schedule maths correct; light theme applied by schedule and previous theme restored |
| `look.uiZoom` | PASS | interface at 125% (dpr 1.25), page content unchanged (dpr 1) |
| `nav.bottom` | PASS | nav bar at the bottom; results list opens upwards and stays on screen |
| `nav.fastForward` | PASS | rel=next followed (content bridge works), URL guessing correct, rewind returned to first page |
| `nav.progress` | PASS | progress shown during load and cleared afterwards |
| `nav.qr` | PASS | QR panel rendered (246px), finder pattern present |
| `page.actions` | PASS | grayscale re-applied on navigation (pixel 54,54,54), cleared back to 255,0,0 |
| `page.breakMode` | PASS | overlay covers the window and click resumes |
| `page.imageToggle` | PASS | pref toggled to block, icon updated, original value restored on disable |
| `panels.downloads` | PASS | live download appears, completes and disappears in the panel |
| `panels.floating` | PASS | open panel overlays the page; page width unchanged |
| `panels.notes` | PASS | panel opens beside the page; notes add/edit/persist/delete; markdown safe; selection -> note |
| `panels.readingList` | PASS | page saved as bookmark in 'Reading List', listed, marked read, removed |
| `panels.web` | PASS | site loads in an out-of-process panel browser with mobile UA; list edits apply live |
| `quickCommands` | PASS | F2 opens; finds tabs and commands; Enter runs; Esc closes |
| `startpage` | PASS | new tab + home overridden; tiles from 'Speed Dial' bookmarks with groups; bookmarks/history sections; restored on disable |
| `statusbar` | PASS | bottom toolbar present, accepts Firefox's own buttons |
| `statusbar.combined` | PASS | page > address bar > tab bar > stack row > status bar, regardless of enable order |
| `statusbar.linkText` | PASS | hover text mirrored into the toolbar item; native overlay restored when item is removed |
| `tabs.appearance` | PASS | close buttons hidden; unread dot on background tab |
| `tabs.clickBehaviors` | PASS | native prefs applied; click on active tab returned to previous tab |
| `tabs.cycler` | PASS | native pref overridden on default branch only |
| `tabs.hibernate` | PASS | background tab unloaded, active tab kept |
| `tabs.hoverPreview` | PASS | native prefs applied |
| `tabs.muteOthers` | PASS | other tabs muted, active left alone, unmute restores |
| `tabs.periodicReload` | PASS | tab reloaded on a 1 s interval, then stopped |
| `tabs.position` | PASS | tab bar under the page, window controls moved to nav bar, tabs functional, restored on disable |
| `tabs.position.left` | PASS | native vertical tabs engaged on the left and reverted on disable |
| `tabs.rename` | PASS | custom title set, survives navigation, clears back to page title |
| `tabs.sessions` | PASS | session saved to disk, reopened here and in a new window, deleted |
| `tabs.tiling` | PASS | two tabs tiled side by side via native Split View, then untiled |
| `tabs.trash` | PASS | closed tab listed and restored from the trash menu |
| `tabs.twoLevel` | PASS | second row lists/switches/extends the active stack; stacks stay folded; label click activates |
| `tabs.workspaces` | PASS | create/switch/move/delete workspaces: tabs only hidden and shown, never closed |
| `widgets.clock` | PASS | clock ticks with seconds; 2 s countdown fired the alarm |
| `widgets.zoom` | PASS | slider sets zoom to 150%; label follows reset to 100% |
| `zoom.perTab` | PASS | native pref applied |

**53/53 passed.**

### Firefox 162.0a1 (build 20261109214446) – each feature enabled alone

| Case | Result | Notes |
|---|---|---|
| `capture` | PASS | full page 1366x3000, visible 1366x683 written as PNG; clipboard has image |
| `core.masterSwitch` | PASS | master switch stops and restores the selected features without touching their own prefs |
| `core.options` | PASS | 48 features listed; toggles and options write prefs live; bad JSON rejected |
| `core.resilience` | PASS | corrupt prefs, unknown/missing commands, new windows and module lookup all degrade safely |
| `input.chains` | PASS | example chain ran its steps in order |
| `input.gestures` | PASS | stroke D recognized over content -> new tab; trail drawn/removed; context menu suppressed |
| `input.rocker` | PASS | rocker back and forward both navigate |
| `input.selectionSearch` | PASS | native pref applied |
| `input.shortcuts` | PASS | combo normalized and ran newTab; unknown/unmapped keys left alone |
| `input.singleKey` | PASS | single key works on page, suppressed in page inputs (IME state) and in the address bar |
| `input.spatialNav` | PASS | focus moved a->b->d->c->a geometrically; text inputs left alone |
| `look.accent` | PASS | theme-color (red) and favicon (green) both tint the tab bar; cleared on blank page |
| `look.autohide` | PASS | toolbars slide away (page top 84px -> ~4px) and return with Ctrl+F11 |
| `look.background` | PASS | image painted on the toolbox; nav bar translucent (color(srgb 0.109804 0.105882 0.133333 / 0.4)) |
| `look.menuButton` | PASS | 8 native menus lent to the button popup and returned intact |
| `look.rounding` | PASS | tabs and address field use the configured 12px radius |
| `look.themeSchedule` | PASS | schedule maths correct; light theme applied by schedule and previous theme restored |
| `look.uiZoom` | PASS | interface at 125% (dpr 1.25), page content unchanged (dpr 1) |
| `nav.bottom` | PASS | nav bar at the bottom; results list opens upwards and stays on screen |
| `nav.fastForward` | PASS | rel=next followed (content bridge works), URL guessing correct, rewind returned to first page |
| `nav.progress` | PASS | progress shown during load and cleared afterwards |
| `nav.qr` | PASS | QR panel rendered (246px), finder pattern present |
| `page.actions` | PASS | grayscale re-applied on navigation (pixel 54,54,54), cleared back to 255,0,0 |
| `page.breakMode` | PASS | overlay covers the window and click resumes |
| `page.imageToggle` | PASS | pref toggled to block, icon updated, original value restored on disable |
| `panels.downloads` | PASS | live download appears, completes and disappears in the panel |
| `panels.floating` | PASS | open panel overlays the page; page width unchanged |
| `panels.notes` | PASS | panel opens beside the page; notes add/edit/persist/delete; markdown safe; selection -> note |
| `panels.readingList` | PASS | page saved as bookmark in 'Reading List', listed, marked read, removed |
| `panels.web` | PASS | site loads in an out-of-process panel browser with mobile UA; list edits apply live |
| `quickCommands` | PASS | F2 opens; finds tabs and commands; Enter runs; Esc closes |
| `startpage` | PASS | new tab + home overridden; tiles from 'Speed Dial' bookmarks with groups; bookmarks/history sections; restored on disable |
| `statusbar` | PASS | bottom toolbar present, accepts Firefox's own buttons |
| `statusbar.combined` | PASS | page > address bar > tab bar > stack row > status bar, regardless of enable order |
| `statusbar.linkText` | PASS | hover text mirrored into the toolbar item; native overlay restored when item is removed |
| `tabs.appearance` | PASS | close buttons hidden; unread dot on background tab |
| `tabs.clickBehaviors` | PASS | native prefs applied; click on active tab returned to previous tab |
| `tabs.cycler` | PASS | native pref overridden on default branch only |
| `tabs.hibernate` | PASS | background tab unloaded, active tab kept |
| `tabs.hoverPreview` | PASS | native prefs applied |
| `tabs.muteOthers` | PASS | other tabs muted, active left alone, unmute restores |
| `tabs.periodicReload` | PASS | tab reloaded on a 1 s interval, then stopped |
| `tabs.position` | PASS | tab bar under the page, window controls moved to nav bar, tabs functional, restored on disable |
| `tabs.position.left` | PASS | native vertical tabs engaged on the left and reverted on disable |
| `tabs.rename` | PASS | custom title set, survives navigation, clears back to page title |
| `tabs.sessions` | PASS | session saved to disk, reopened here and in a new window, deleted |
| `tabs.tiling` | PASS | two tabs tiled side by side via native Split View, then untiled |
| `tabs.trash` | PASS | closed tab listed and restored from the trash menu |
| `tabs.twoLevel` | PASS | second row lists/switches/extends the active stack; stacks stay folded; label click activates |
| `tabs.workspaces` | PASS | create/switch/move/delete workspaces: tabs only hidden and shown, never closed |
| `widgets.clock` | PASS | clock ticks with seconds; 2 s countdown fired the alarm |
| `widgets.zoom` | PASS | slider sets zoom to 150%; label follows reset to 100% |
| `zoom.perTab` | PASS | native pref applied |

**53/53 passed.**

### Firefox 162.0a1 (build 20261109214446) – all features enabled together

| Case | Result | Notes |
|---|---|---|
| `capture` | PASS | full page 1326x3000, visible 1326x657 written as PNG; clipboard has image |
| `core.masterSwitch` | PASS | skipped in all-on mode |
| `core.options` | PASS | skipped in all-on mode |
| `core.resilience` | PASS | skipped in all-on mode |
| `input.chains` | PASS | example chain ran its steps in order |
| `input.gestures` | PASS | stroke D recognized over content -> new tab; trail drawn/removed; context menu suppressed |
| `input.rocker` | PASS | rocker back and forward both navigate |
| `input.selectionSearch` | PASS | native pref applied |
| `input.shortcuts` | PASS | combo normalized and ran newTab; unknown/unmapped keys left alone |
| `input.singleKey` | PASS | single key works on page, suppressed in page inputs (IME state) and in the address bar |
| `input.spatialNav` | PASS | focus moved a->b->d->c->a geometrically; text inputs left alone |
| `look.accent` | PASS | theme-color (red) and favicon (green) both tint the tab bar; cleared on blank page |
| `look.autohide` | PASS | toolbars slide away (page top 0px -> ~4px) and return with Ctrl+F11 |
| `look.background` | PASS | image painted on the toolbox; nav bar translucent (color(srgb 1 1 1 / 0.4)) |
| `look.menuButton` | PASS | 8 native menus lent to the button popup and returned intact |
| `look.rounding` | PASS | tabs and address field use the configured 12px radius |
| `look.themeSchedule` | PASS | schedule maths correct; light theme applied by schedule and previous theme restored |
| `look.uiZoom` | PASS | interface at 125% (dpr 1.25), page content unchanged (dpr 1) |
| `nav.bottom` | PASS | nav bar at the bottom; results list opens upwards and stays on screen |
| `nav.fastForward` | PASS | rel=next followed (content bridge works), URL guessing correct, rewind returned to first page |
| `nav.progress` | PASS | progress shown during load and cleared afterwards |
| `nav.qr` | PASS | QR panel rendered (246px), finder pattern present |
| `page.actions` | PASS | grayscale re-applied on navigation (pixel 54,54,54), cleared back to 255,0,0 |
| `page.breakMode` | PASS | overlay covers the window and click resumes |
| `page.imageToggle` | PASS | pref toggled to block, icon updated, original value restored on disable |
| `panels.downloads` | PASS | live download appears, completes and disappears in the panel |
| `panels.floating` | PASS | open panel overlays the page; page width unchanged |
| `panels.notes` | PASS | panel opens beside the page; notes add/edit/persist/delete; markdown safe; selection -> note |
| `panels.readingList` | PASS | page saved as bookmark in 'Reading List', listed, marked read, removed |
| `panels.web` | PASS | site loads in an out-of-process panel browser with mobile UA; list edits apply live |
| `quickCommands` | PASS | F2 opens; finds tabs and commands; Enter runs; Esc closes |
| `startpage` | PASS | new tab + home overridden; tiles from 'Speed Dial' bookmarks with groups; bookmarks/history sections; restored on disable |
| `statusbar` | PASS | bottom toolbar present, accepts Firefox's own buttons |
| `statusbar.combined` | PASS | page > address bar > tab bar > stack row > status bar, regardless of enable order |
| `statusbar.linkText` | PASS | hover text mirrored into the toolbar item; native overlay restored when item is removed |
| `tabs.appearance` | PASS | close buttons hidden; unread dot on background tab |
| `tabs.clickBehaviors` | PASS | native prefs applied; click on active tab returned to previous tab |
| `tabs.cycler` | PASS | native pref overridden on default branch only |
| `tabs.hibernate` | PASS | background tab unloaded, active tab kept |
| `tabs.hoverPreview` | PASS | native prefs applied |
| `tabs.muteOthers` | PASS | other tabs muted, active left alone, unmute restores |
| `tabs.periodicReload` | PASS | tab reloaded on a 1 s interval, then stopped |
| `tabs.position` | PASS | tab bar under the page, window controls moved to nav bar, tabs functional, restored on disable |
| `tabs.position.left` | PASS | native vertical tabs engaged on the left and reverted on disable |
| `tabs.rename` | PASS | custom title set, survives navigation, clears back to page title |
| `tabs.sessions` | PASS | session saved to disk, reopened here and in a new window, deleted |
| `tabs.tiling` | PASS | two tabs tiled side by side via native Split View, then untiled |
| `tabs.trash` | PASS | closed tab listed and restored from the trash menu |
| `tabs.twoLevel` | PASS | second row lists/switches/extends the active stack; stacks stay folded; label click activates |
| `tabs.workspaces` | PASS | create/switch/move/delete workspaces: tabs only hidden and shown, never closed |
| `widgets.clock` | PASS | clock ticks with seconds; 2 s countdown fired the alarm |
| `widgets.zoom` | PASS | slider sets zoom to 150%; label follows reset to 100% |
| `zoom.perTab` | PASS | native pref applied |

**53/53 passed.**
