/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. */

/**
 * Feature registry: the single declarative list of everything the mod can do.
 *
 *   id       pref root: vivaldifox.<id>.enabled (default false)
 *   module   features/<id>/main.sys.mjs exists
 *   css      features/<id>/style.css exists
 *   cssOnly  the CSS is useful on its own (included in the userChrome.css fallback)
 *   native   Firefox prefs overridden (default branch only) while enabled
 *   options  per-feature settings -> vivaldifox.<id>.<key>
 *            type: bool | int | string | enum | json ; `live: true` means the
 *            feature reads the option on demand and need not be restarted.
 */
export const FEATURES = [
  // ───────────────────────────── Tabs ─────────────────────────────
  {
    id: "tabs.cycler", cat: "Tabs", title: "Tab cycler in recent-use order",
    desc: "Ctrl+Tab cycles tabs most-recently-used first, with a visual preview list.",
    native: { "browser.ctrlTab.sortByRecentlyUsed": true },
  },
  {
    id: "tabs.hoverPreview", cat: "Tabs", title: "Tab hover thumbnails",
    desc: "Show a page thumbnail when hovering a tab.",
    native: { "browser.tabs.hoverPreview.enabled": true, "browser.tabs.hoverPreview.showThumbnails": true },
  },
  {
    id: "tabs.hibernate", cat: "Tabs", title: "Hibernate background tabs",
    desc: "Tab context menu item and command that unload every background tab to free memory.",
    module: true,
    options: { skipPinned: { type: "bool", default: true, label: "Keep pinned tabs loaded", live: true } },
  },
  {
    id: "tabs.periodicReload", cat: "Tabs", title: "Periodic reload",
    desc: "Reload a tab automatically every N minutes (tab context menu).",
    module: true, css: true,
  },
  {
    id: "tabs.trash", cat: "Tabs", title: "Closed-tabs trash can",
    desc: "Toolbar button listing recently closed tabs and windows.",
    module: true,
    options: { maxItems: { type: "int", default: 25, label: "Maximum tabs listed", live: true } },
  },
  {
    id: "tabs.clickBehaviors", cat: "Tabs", title: "Tab click and wheel behaviours",
    desc: "Double-click to close, wheel to switch tabs, click the active tab to return to the previous one.",
    module: true,
    options: {
      doubleClickClose: { type: "bool", default: true, label: "Double-click closes the tab" },
      wheelSwitch: { type: "bool", default: true, label: "Mouse wheel over the tab bar switches tabs" },
      activeToPrevious: { type: "bool", default: false, label: "Clicking the active tab switches to the previous tab" },
    },
  },
  {
    id: "tabs.rename", cat: "Tabs", title: "Rename tab",
    desc: "Give a tab a custom title (tab context menu). Persists across navigation and restart.",
    module: true,
  },
  {
    id: "tabs.muteOthers", cat: "Tabs", title: "Mute other tabs",
    desc: "Context menu item and command to mute all other tabs; optionally only the active tab may play audio.",
    module: true,
    options: { activeOnly: { type: "bool", default: false, label: "Play audio only in the active tab" } },
  },
  {
    id: "tabs.appearance", cat: "Tabs", title: "Tab appearance options",
    desc: "Close-button placement, unread indicator, minimum tab width.",
    module: true, css: true,
    options: {
      closeButton: { type: "enum", values: ["default", "hover", "left", "hidden"], default: "hover", label: "Close button" },
      unreadIndicator: { type: "bool", default: true, label: "Mark unread background tabs" },
      activeBold: { type: "bool", default: false, label: "Bold title on the active tab" },
      minWidth: { type: "int", default: 0, label: "Minimum tab width in px (0 = Firefox default)" },
    },
  },
  {
    id: "tabs.position", cat: "Tabs", title: "Tab bar position",
    desc: "Tab bar at the bottom, left or right. Left/right use Firefox's native vertical tabs; bottom moves the tab bar below the page.",
    module: true, css: true,
    options: { position: { type: "enum", values: ["bottom", "left", "right", "top"], default: "bottom", label: "Position" } },
  },
  {
    id: "tabs.tiling", cat: "Tabs", title: "Tab tiling (side by side)",
    desc: "Commands, a button and a tab-menu item to tile two tabs side by side, on top of Firefox's Split View.",
    module: true,
  },
  {
    id: "tabs.workspaces", cat: "Tabs", title: "Workspaces",
    desc: "Named sets of tabs; only the active workspace's tabs are shown. Tabs are hidden, never closed.",
    module: true, css: true,
  },
  {
    id: "tabs.sessions", cat: "Tabs", title: "Named sessions",
    desc: "Save the open tabs under a name and reopen them later.",
    module: true,
  },
  {
    id: "tabs.twoLevel", cat: "Tabs", title: "Two-level tab stacks",
    desc: "Tab groups act as stacks: a second row under the tab bar lists the tabs of the active stack.",
    module: true, css: true,
    options: { collapseStacks: { type: "bool", default: true, label: "Keep stacks folded in the main tab bar" } },
  },

  // ───────────────────── Address bar & navigation ─────────────────────
  {
    id: "nav.fastForward", cat: "Navigation", title: "Fast Forward / Rewind",
    desc: "Buttons and commands: jump to the next page of a series (rel=next, \"Next\" links, numbered URLs) or rewind to the first page visited on the site.",
    module: true,
    options: { guessUrl: { type: "bool", default: true, label: "Guess the next page by incrementing numbers in the URL", live: true } },
  },
  {
    id: "nav.qr", cat: "Navigation", title: "QR code for the current page",
    desc: "Toolbar button that shows the page address as a QR code.",
    module: true,
  },
  {
    id: "nav.progress", cat: "Navigation", title: "Load progress in the address field",
    desc: "Paints page-load progress behind the address text.",
    module: true, css: true,
  },
  {
    id: "nav.bottom", cat: "Navigation", title: "Address bar at the bottom",
    desc: "Moves the navigation toolbar below the page; address-bar results open upwards.",
    module: true, css: true,
  },
  {
    id: "page.actions", cat: "Page", title: "Page Actions",
    desc: "Per-tab CSS filters: grayscale, invert, sepia, monospace fonts, hide images and more.",
    module: true,
  },
  {
    id: "page.breakMode", cat: "Page", title: "Break Mode",
    desc: "Pause all media and cover the browser until you come back.",
    module: true, css: true,
  },
  {
    id: "page.imageToggle", cat: "Page", title: "Image loading toggle",
    desc: "Toolbar button to switch image loading: all, no third-party, none (global setting).",
    module: true,
    options: { reloadOnChange: { type: "bool", default: true, label: "Reload the current tab after switching", live: true } },
  },
  {
    id: "zoom.perTab", cat: "Page", title: "Per-tab zoom",
    desc: "Zoom applies to the tab only instead of to every page of the site.",
    native: { "browser.zoom.siteSpecific": false },
  },
  {
    id: "capture", cat: "Page", title: "Capture",
    desc: "Capture the full page or visible area to a file or the clipboard; area selection via Firefox Screenshots.",
    module: true,
    options: {
      format: { type: "enum", values: ["png", "jpg"], default: "png", label: "File format", live: true },
      folder: { type: "string", default: "", label: "Save folder (empty = Downloads)", live: true },
    },
  },

  // ───────────────────────────── Status bar ─────────────────────────────
  // Keep `statusbar` ahead of the widgets: they pick it as their first-time
  // home when it is already running (they work in any toolbar regardless).
  {
    id: "statusbar", cat: "Status bar", title: "Status bar",
    desc: "A customizable toolbar at the bottom of the window. Drag any button into it in Customize mode.",
    module: true, css: true,
    options: { compact: { type: "bool", default: false, label: "Compact height" } },
  },
  {
    id: "statusbar.linkText", cat: "Status bar", title: "Status text item",
    desc: "Hovered-link and loading status as a toolbar item instead of a floating overlay (place it in any toolbar).",
    module: true, css: true,
  },
  {
    id: "widgets.zoom", cat: "Status bar", title: "Zoom slider",
    desc: "Page zoom slider widget for any toolbar.",
    module: true, css: true,
  },
  {
    id: "widgets.clock", cat: "Status bar", title: "Clock",
    desc: "Clock widget with a countdown timer.",
    module: true, css: true,
    options: {
      hour24: { type: "bool", default: true, label: "24-hour time", live: true },
      seconds: { type: "bool", default: false, label: "Show seconds", live: true },
      date: { type: "bool", default: false, label: "Show date", live: true },
    },
  },

  // ───────────────────────── Input & commands ─────────────────────────
  {
    id: "input.gestures", cat: "Input", title: "Mouse gestures",
    desc: "Hold the right mouse button and draw: L back, R forward, D new tab, DR close tab, UD reload… Works on every page, including about: pages.",
    module: true, css: true,
    options: {
      map: {
        type: "json", label: "Gesture map (stroke of U/D/L/R -> command id)",
        default: { L: "back", R: "forward", D: "newTab", DR: "closeTab", UL: "reopenTab", UD: "reload", DU: "scrollTop", U: "scrollTop", RD: "scrollBottom", RL: "prevTab", LR: "nextTab", UR: "fullscreen" },
      },
      trail: { type: "bool", default: true, label: "Draw the gesture trail" },
    },
  },
  {
    id: "input.rocker", cat: "Input", title: "Rocker gestures",
    desc: "Hold the right button and click left to go back; hold left and click right to go forward.",
    module: true,
    options: {
      rightThenLeft: { type: "string", default: "back", label: "Command for right-hold + left-click", live: true },
      leftThenRight: { type: "string", default: "forward", label: "Command for left-hold + right-click", live: true },
    },
  },
  {
    id: "quickCommands", cat: "Input", title: "Quick Commands",
    desc: "Keyboard palette (F2) to search commands, open tabs, bookmarks and history.",
    module: true, css: true,
    options: {
      key: { type: "string", default: "F2", label: "Shortcut" },
      maxResults: { type: "int", default: 12, label: "Maximum command/tab results", live: true },
    },
  },
  {
    id: "input.shortcuts", cat: "Input", title: "Custom keyboard shortcuts",
    desc: "Bind any key combination to any command. Map a combination to \"none\" to disable it.",
    module: true,
    options: { map: { type: "json", default: { "Alt+P": "vfx.options" }, label: "Shortcut map (\"Ctrl+Shift+Y\" -> command id)" } },
  },
  {
    id: "input.singleKey", cat: "Input", title: "Single-key shortcuts",
    desc: "One-key shortcuts that are active only when you are not typing in a text field.",
    module: true,
    options: { map: { type: "json", default: { 1: "prevTab", 2: "nextTab", Z: "back", X: "forward" }, label: "Key map (key -> command id)" } },
  },
  {
    id: "input.chains", cat: "Input", title: "Command chains",
    desc: "Define sequences of commands and run them from a toolbar menu, a shortcut, a gesture or Quick Commands.",
    module: true,
    options: {
      chains: {
        type: "json", label: "Chains: [{ id, label, steps: [commandId | {wait: ms} | {open: url}] }]",
        default: [{ id: "example", label: "Example: new tab, then focus the address bar", steps: ["newTab", { wait: 200 }, "focusUrlbar"] }],
      },
    },
  },
  {
    id: "input.spatialNav", cat: "Input", title: "Spatial navigation",
    desc: "Shift+Arrow keys move focus to the nearest link or control in that direction.",
    module: true,
  },
  {
    id: "input.selectionSearch", cat: "Input", title: "Search selection in a background tab",
    desc: "\"Search for …\" on selected text opens the results in a background tab.",
    native: { "browser.search.context.loadInBackground": true },
  },

  // ───────────────────────────── Panels ─────────────────────────────
  {
    id: "panels.notes", cat: "Panels", title: "Notes panel",
    desc: "Markdown notes in the side panel, with \"Add Selection as Note\" in the page context menu.",
    module: true, css: true,
  },
  {
    id: "panels.downloads", cat: "Panels", title: "Downloads panel",
    desc: "Downloads list in the side panel.",
    module: true, css: true,
  },
  {
    id: "panels.readingList", cat: "Panels", title: "Reading List panel",
    desc: "Save pages to read later. Items are bookmarks in a \"Reading List\" folder, so they sync.",
    module: true, css: true,
  },
  {
    id: "panels.web", cat: "Panels", title: "Web Panels",
    desc: "Pin websites in the side panel (mobile layout by default). Right-click a panel icon to remove it.",
    module: true, css: true,
    options: { sites: { type: "json", default: [{ url: "https://en.m.wikipedia.org/", title: "Wikipedia", mobile: true }], label: "Sites: [{ url, title?, mobile? }]" } },
  },
  {
    id: "panels.floating", cat: "Panels", title: "Floating panel",
    desc: "The open panel overlays the page instead of narrowing it.",
    css: true, cssOnly: true,
  },

  // ───────────────────────────── Start page ─────────────────────────────
  {
    id: "startpage", cat: "Start page", title: "Start Page with Speed Dial",
    desc: "Replaces the new-tab page with a Speed Dial (bookmarks in a \"Speed Dial\" folder; subfolders are groups) plus Bookmarks and History sections.",
    module: true,
    options: {
      setHome: { type: "bool", default: true, label: "Also use it as the home page" },
      columns: { type: "int", default: 5, label: "Speed Dial columns", live: true },
      thumbnails: { type: "bool", default: true, label: "Show page thumbnails on tiles", live: true },
      background: { type: "string", default: "", label: "Background image (URL or file path)", live: true },
      backgroundDim: { type: "int", default: 35, label: "Background dimming (0-90 %)", live: true },
      historyItems: { type: "int", default: 150, label: "History entries shown", live: true },
    },
  },

  // ───────────────────────────── Look & feel ─────────────────────────────
  {
    id: "look.accent", cat: "Look & feel", title: "Accent colour from the page",
    desc: "The tab bar takes the colour of the active page (theme-color, else favicon).",
    module: true, css: true,
    options: {
      themeColor: { type: "bool", default: true, label: "Use the page's theme-color when it has one" },
      favicon: { type: "bool", default: true, label: "Fall back to the favicon's dominant colour" },
      strength: { type: "int", default: 85, label: "Colour strength (10-100 %)" },
    },
  },
  {
    id: "look.themeSchedule", cat: "Look & feel", title: "Scheduled themes",
    desc: "Switch between a light and a dark Firefox theme at set times of day.",
    module: true,
    options: {
      lightTheme: { type: "string", default: "firefox-compact-light@mozilla.org", label: "Light theme (add-on id)" },
      darkTheme: { type: "string", default: "firefox-compact-dark@mozilla.org", label: "Dark theme (add-on id)" },
      lightStart: { type: "string", default: "07:00", label: "Light theme from (HH:MM)" },
      darkStart: { type: "string", default: "19:00", label: "Dark theme from (HH:MM)" },
    },
  },
  {
    id: "look.rounding", cat: "Look & feel", title: "Corner rounding",
    desc: "One corner radius for tabs, the address field, buttons and popups.",
    module: true, css: true,
    options: { radius: { type: "int", default: 10, label: "Radius in px (0-24)" } },
  },
  {
    id: "look.uiZoom", cat: "Look & feel", title: "User interface zoom",
    desc: "Scale the browser interface without scaling web pages.",
    module: true,
    options: { percent: { type: "int", default: 110, label: "Interface zoom in % (50-200)" } },
  },
  {
    id: "look.background", cat: "Look & feel", title: "Window background image",
    desc: "Show an image behind the tab bar and toolbars.",
    module: true, css: true,
    options: {
      image: { type: "string", default: "", label: "Image (URL or file path)" },
      toolbarOpacity: { type: "int", default: 60, label: "Toolbar opacity over the image (0-100 %)" },
    },
  },
  {
    id: "look.autohide", cat: "Look & feel", title: "Hide the user interface",
    desc: "Shortcut and command to hide all toolbars, optionally revealing them on hover at the top edge.",
    module: true, css: true,
    options: {
      key: { type: "string", default: "Ctrl+F11", label: "Shortcut" },
      revealOnHover: { type: "bool", default: true, label: "Reveal toolbars when the pointer is at the top edge" },
      startHidden: { type: "bool", default: false, label: "Start with the interface hidden" },
    },
  },
  {
    id: "look.menuButton", cat: "Look & feel", title: "Menu button",
    desc: "A single button that opens the classic File/Edit/View… menu as one cascading menu.",
    module: true,
  },
];
