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
