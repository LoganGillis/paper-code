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
- Clicking a page **replaces** the current tab. Right-click **Open in new tab**, or middle-click, to add one. Middle-click a tab to close it.
- `⌘1`–`⌘9` switch **user** tabs (desk is skipped). `⌘W` closes a **tab**, not the window.
- The desk is a permanently pinned icon tab on the left of the strip. It cannot be closed.
- Pages can be **archived**. Sidebar archive icon (next to Guide) toggles that view.
- Page title + icon picker in the header (locked on the Guide).
- Selection color is a translucent wash of the **page** accent (`--page-accent`).
- Find/replace on code pages uses the custom FindBar, not CodeMirror’s default panel. Markdown pages support ⌘F / Ctrl+F.
- **Open beside** splits the current tab: one tab, two panes. The tab shows both titles; click a half to focus that pane. Tab **X** closes the pair. `⌘W` unsplits first, then closes the remaining page.
- Drag pages and folders in the sidebar to reorder. Right-click a space to export or import a folder of files (`paper.json`; secret **names** only).

## Desk

One root desk for the whole app. Pinned as an icon-only House tab (slate). Not in the sidebar tree.

- Today’s date as the page title, weekday and clock underneath.
- Week stamps (Monday start). Today has a border. Days are not buttons.
- Ruled capture line: Enter creates a Markdown page in the current space.
- Recent list: last-updated pages across all spaces.

Virtual id `paper:desk`. Not in the DB. Cannot be closed (`⌘W` is a no-op on it).

## Guide

Book button, bottom-left of the sidebar. Opens as a normal Markdown tab that **cannot be edited**.

- Virtual id `paper:guide`. Sample tables are hidden Guide CSVs (`paper:guide:orders`, `paper:guide:products`) so examples still run after the user deletes seed pages.
- Title/icon static. No slash or wiki menus. Language toggle hidden on read-only run blocks.
- Runnable examples still run (main synthesizes a page if `pageId` is missing).
- Current section: **`$` helpers** only. Other sections later, on purpose.

## Markdown

TipTap. Live, like Notion.

Slash (`/`): text, headings, lists, quote, divider, runnable script, plain code, CSV preview, chart, page link.

Also: `[[` wiki page picker.

Custom blocks:

| Node | File | Notes |
| --- | --- | --- |
| `runnableCode` | `md-run-block.tsx` | JS/TS, CodeMirror, Run with page accent. Maximize opens it as a virtual code page (`paper:block/…`) with a back link. |
| `csvEmbed` | `md-csv-embed.tsx` | Full CSV editor (same as the page) |
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

First launch (`seedIfEmpty`) creates **Workshop** with Welcome, Notes/Scratch, Scripts/{hello,today,sales}, and Data/{orders,products,employees}, then opens **Welcome**. Scripts use `console.log` only — a leftover expression at the end of a file errors. Reset with `pnpm seed`. Helper test pages are not installed automatically.
