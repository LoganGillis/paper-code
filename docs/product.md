# Product

Paper is a local notebook: spaces, folders, pages. The metaphor is a **desk**, not a browser.

## Spaces and tree

- A **space** is a workspace (icon + color, its own secrets).
- Folders nest. Pages live in a folder or at the space root.
- Sidebar: search (`⌘K`), create space, tree, Guide book (bottom-left), Settings (bottom-right).
- Space **•••** and right-click: new page types, **Secrets**, duplicate, copy, delete.
- Hover a row: type badge swaps for the item menu / close control.
- Type badges stay muted. Icon chips use the item’s color.

## Window chrome

- Native title bar is hidden (`titleBarStyle: hiddenInset` on macOS).
- Traffic lights sit in the sidebar header. Search is padded so it does not crowd them (`pl-[92px]` on Mac).
- Tabs live in that same top strip on the paper side — compact pills, not hanging folders.
- The strip is `-webkit-app-region: drag`; tabs and buttons are `no-drag`.
- The tab strip stays visible with no pages open so the desk does not jump.
- Double-click empty chrome zooms the window (macOS).

## Tabs and pages

- Multi-space tabs. Keep-alive panes (no remount flicker). Preserve editor focus when switching with the keyboard.
- `⌘1`–`⌘9` switch tabs. `⌘W` closes a **tab**, not the window.
- Closing the last tab shows the **desk** for the current space. Do not reopen Notes (or any first page).
- Page title + icon picker in the header (locked on the Guide).
- Selection color is a translucent wash of the **page** accent (`--page-accent`).
- Find/replace on code pages uses the custom FindBar, not CodeMirror’s default panel.

## Desk

Empty tabs, or **Desk** at the top of a space tree.

- Space icon + today’s date as the page title, weekday and clock underneath.
- Week stamps (Monday start). Today uses the space icon-chip. A dot means that date already has a note.
- Click a day: open or create `MMMM D, YYYY` in a **Journal** folder (created on first daily note, Calendar icon, space color).
- Ruled capture line: Enter creates a Markdown page (active folder if any, else space root).
- Recent list: last-updated pages as sidebar-style rows.

Desk is virtual (`paper:desk:${spaceId}`). Not in the DB.

## Guide

Book button, bottom-left of the sidebar. Opens as a normal Markdown tab that **cannot be edited**.

- Virtual id `paper:guide`. Rebuilt from current trees so CSV embeds and page links resolve.
- Title/icon static. No slash or wiki menus. Language toggle on run blocks disabled.
- Runnable examples still run (main synthesizes a page if `pageId` is missing).
- Current section: **`$` helpers** only. Other sections later, on purpose.

## Markdown

TipTap. Live, like Notion.

Slash (`/`): text, headings, lists, quote, divider, runnable script, plain code, CSV preview, chart, page link.

Also: `[[` wiki page picker.

Custom blocks:

| Node | File | Notes |
| --- | --- | --- |
| `runnableCode` | `md-run-block.tsx` | JS/TS, Run with page accent, `⌘↵` |
| `csvEmbed` | `md-csv-embed.tsx` | Preview a CSV page |
| `chartEmbed` | `md-chart-embed.tsx` | Chart a CSV page (kind / x / y attrs) |
| `pageLink` | `md-page-link.tsx` | Inline link chip |

Compact TipTap is used for code/CSV **descriptions** only (no custom nodes).

Block-level click-drag multi-select was tried and **removed**.

## Code pages

CodeMirror 6. Sucrase + `vm` in main. Console under a resizable splitter.

- Run button uses `RUN_ACCENT[page.iconColor]`.
- Output is selectable. `console.log` prints `$Date` as a readable string, not `$time(…)`.
- Completions: locals, standard JS, `$` APIs with descriptions. Script font is slightly small.

## CSV pages

Grid editor (select, fill, copy). Toolbar: **Table / Chart**.

Charts: bar, line, area. Pick X and Y. Duplicate X values are **summed**. Dates default to line. Accent follows the page. Last view and axes persist in `localStorage` (`paper.csvView.*`, `paper.chart.*`).

Markdown `/chart` embeds the same renderer, pointing at a CSV page in the space.

Sample data (seeded if missing): `Data/{orders,products,employees}` and `Helpers/{dates,csv,…}`. Helper demos are ensured at startup — if you do not see them, an old Electron process may still be running.

## Secrets

Space **••• → Secrets**, not Settings.

- Names only in the UI. Values sealed with `safeStorage` (OS keychain). No plaintext fallback.
- Peek only the value you are about to save. Replace never shows the old value.
- Scripts: `$secret("API_KEY")` or `$secrets.API_KEY`. Logging `$secrets` prints **names**.
- **Expose to other spaces** is off by default. If on, other spaces can read these keys; the current space wins collisions.

## Settings

Appearance only (system / light / dark).

## Shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` | Search |
| `⌘↵` | Run script or Markdown run block |
| `⌘W` | Close tab |
| `⌘⇧W` | Close window |
| `⌘1`–`⌘9` | Switch tab (`⌘9` = last) |
| `/` | Slash menu (Markdown) |
| `[[` | Page link picker |

## UX decisions that should stick

- Quiet type badges; color lives on the icon chip.
- Inactive tabs sit slightly up (`mb-1` was for the old hanging tabs; current tabs are pills in the title bar).
- Sidebar depth is **inset** shadow, not a drop shadow outside the rail.
- Inactive tab / paper used to match too well — the rail is a mix of paper and sidebar.
- Extra newline on run was caused by both a keymap and a keydown handler; run is `Prec.highest` Mod-Enter plus capture.
- Page flicker on file change: keep-alive panes + cache, no fade remount.

## Seed voice

First space is often **Workshop**. Helper pages live under **Helpers** and **Data**. Do not delete those folders in seed logic without a replacement.
