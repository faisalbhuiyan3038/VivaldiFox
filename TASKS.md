# VivaldiFox task list

Legend: `[x]` done and tested in real Firefox · `[!]` done, with a limitation recorded in the README · `[-]` documentation only (already native in Firefox) · `[ ]` open

## Phase 1 – Feature inventory
- [x] Inventory produced and reviewed
- [x] Scope locked: excluded T2, T4, P7, P8, D3, tiling of 3+ tabs, mail/sync/VPN/ad blocker; T3 implemented last
- [x] Decisions: privileged JS loader accepted; native-first where Firefox has an equivalent

## Phase 2 – Architecture and config
- [x] Test harness: private copies of Firefox 159.0.1 and Nightly 162.0a1, Marionette client (`test/fx.mjs`), runner with local HTTP server (`test/run.mjs`)
- [x] Loader: `install/config.js` + `config-prefs.js` → `<profile>/chrome/vivaldifox/boot.sys.mjs`
- [x] Feature registry, per-feature prefs, master switch `vivaldifox.enabled`
- [x] Scope-based teardown, failure isolation, live toggling, async feature start
- [x] Shared infrastructure: command registry, key engine, pointer helpers, JSON store, panel host, toolbar relocation, module resolver
- [x] Content bridge (frame scripts; runtime JSWindowActors are refused by Firefox 159)
- [x] Settings page (`chrome://vivaldifox/content/options/options.html`, Tools menu entry)
- [x] CSS-only fallback (`fallback/userChrome.css`, `fallback/user.js`)
- [x] Installers: `install.ps1`, `install.sh`; merge with an existing autoconfig loader; uninstall
- [x] README

## Phase 3 – Implementation (each: implemented, then tested in Firefox 159 and 162)

### Tabs
- [!] T1 `tabs.position` – bottom (moved toolbar) / left / right (native vertical tabs)
- [!] T5 `tabs.tiling` – two tabs, on native Split View
- [x] T6 `tabs.workspaces`
- [x] T7 `tabs.cycler`
- [x] T8 `tabs.hoverPreview`
- [x] T9 `tabs.hibernate`
- [x] T10 `tabs.periodicReload`
- [x] T11 `tabs.trash`
- [x] T12 `tabs.clickBehaviors`
- [x] T13 `tabs.rename`
- [x] T14 `tabs.muteOthers`
- [!] T15 `tabs.sessions` – addresses, titles, pinned state (no per-tab history)
- [x] T16 `tabs.appearance`
- [-] T17 windows/tabs tree – native vertical tabs / Sidebery
- [!] T3 `tabs.twoLevel` – two-level stacks on native tab groups (done last; most version-sensitive)

### Address bar and navigation
- [!] A1 `nav.fastForward` – heuristic next-page detection
- [x] A2 `page.actions`
- [x] A3 `nav.qr`
- [x] A4 `nav.progress`
- [!] A5 `nav.bottom` – layout-sensitive
- [x] A6 `page.breakMode`
- [!] A7 `page.imageToggle` – global, no "cached only"
- [-] A8 nicknames, paste-and-go, reader view – native

### Panels
- [!] P1 `panels.web` – extension behaviour inside panels not verified
- [x] P2 `panels.notes`
- [x] P3 `panels.downloads`
- [-] P4 bookmarks/history panels – native sidebar
- [x] P5 `panels.readingList`
- [x] P6 `panels.floating` (stacking bug found by screenshot review, fixed, test now hit-tests pixels)

### Status bar
- [x] S1 `statusbar`
- [x] S2 `statusbar.linkText`
- [x] S3 `widgets.zoom`
- [x] S4 `widgets.clock`
- [x] S5 capture and page-action buttons (part of `capture`, `page.actions`)

### Start page
- [x] D1 `startpage` – Speed Dial from bookmarks, groups from subfolders
- [x] D2 Bookmarks and History sections (Notes section while notes is on)
- [x] D4 background image option

### Input and commands
- [x] I1 `input.gestures`
- [x] I2 `input.rocker`
- [x] I3 `quickCommands`
- [x] I4 `input.shortcuts`
- [x] I5 `input.singleKey`
- [x] I6 `input.chains`
- [!] I7 `input.spatialNav` – heuristic; not in cross-site iframes
- [x] I8 `input.selectionSearch` (native pref)

### Capture and tools
- [!] C1 `capture` – area selection delegated to Firefox Screenshots (not automated)
- [x] C2 capture → note (optional bridge, offered only while notes is on)
- [x] C3 `zoom.perTab`
- [-] C4 pop-out video – native Picture-in-Picture

### Look and feel
- [x] L1 `look.accent`
- [!] L2 `look.themeSchedule` – time-based switching of two installed themes (no theme editor)
- [x] L3 `look.rounding`, `look.uiZoom`
- [x] L4 `look.background`
- [x] L5 `look.autohide`
- [!] L6 `look.menuButton` – not meaningful on macOS
- [-] L7 toolbar editor – native Customize mode

## Phase 4 – Testing, docs, delivery
- [x] Per-feature run on a clean profile, Firefox 159.0.1
- [x] Per-feature run on a clean profile, Nightly 162.0a1
- [x] All features enabled together, both builds
- [x] Independence checks: only the feature under test running; no residue after disable
- [x] Cold start with all 48 features on, with session restore (rename and workspaces persist)
- [x] Installer tests: fresh install, merge with a foreign loader, reinstall, uninstall, CSS-only mode
- [x] Test report (`docs/TEST-REPORT.md`) with raw results (`docs/results/`)
- [x] README: install for stable and Nightly, every toggle, limitations, fragility table, trade-offs

## Open / not verified
- [ ] Linux and macOS: not tested (no such machine available). `install.sh` was exercised under Git Bash on Windows only.
- [ ] Physical mouse and keyboard: tests synthesize input events inside the browser; gestures and rocker gestures were not exercised with a real mouse.
- [ ] Extensions inside web panels (content blockers, password managers).
- [ ] Installation into the real `C:\Program Files\Mozilla Firefox` (left to the user: needs elevation, and that install already carries a Sine loader, which the installer is designed to merge with).
- [ ] Nothing has been committed to git; the working tree is ready to review.
