# Architecture

## Processes

```
┌─────────────┐   IPC RPC    ┌──────────────────┐
│  Renderer   │ ───────────► │  Main            │
│  React      │  desktop:rpc │  procedures.ts   │
│  TipTap /   │              │  Prisma + SQLite │
│  CodeMirror │ ◄─────────── │  sucrase + vm    │
└─────────────┘   results    │  safeStorage     │
                             └──────────────────┘
        preload: window.api.invoke / onCloseTab
```

- **electron-vite**: `src/main`, `src/preload`, `src/renderer`.
- Renderer HMR is live. **Main and preload rebuild on file change but the running Electron process keeps the old main until restart.**
- `titleBarStyle: 'hiddenInset'` (macOS), `trafficLightPosition: { x: 16, y: 16 }`. Windows/Linux: hidden + `titleBarOverlay`.
- `⌘W` is intercepted in `before-input-event` and the File menu so the window does not close. Debounce ~80ms because menu + keydown can both fire.

## RPC

`src/shared/api.ts` defines `AppApi`. `src/main/rpc.ts` splits `namespace.method` and calls `procedures[namespace][method]`. Unknown methods return `Unknown procedure: …` — usually a **stale main process**.

Renderer wrapper: `src/renderer/src/lib/rpc.ts`.

When adding a method: type, procedure, and `api` object must all exist. Then restart the app.

## Data

Prisma 7 + SQLite (`better-sqlite3`). Client generated to `src/generated/prisma` (gitignored). The packaged app must pass `nativeBinding` to the unpacked `better_sqlite3.node` — electron-builder leaves a 0-byte stub inside the asar.

| Model | Role |
| --- | --- |
| Space | Workspace, icon, `secretsExposed` |
| Folder | Nested, `onDelete: Cascade` |
| Page | `markdown` \| `javascript` \| `typescript` \| `csv` |
| Secret | `valueEnc`, unique `(spaceId, key)` |

Dev DB: `prisma/dev.db`. App config path from `app.getConfig()`.

`PageSummary` includes `updatedAt` so the desk can sort recent pages. Serializers live in `procedures.ts`.

First launch: `seedIfEmpty` (`src/main/seed.ts`). Reset the dev database with `pnpm seed`. Do not leave a trailing expression in example scripts.

## Workspace (renderer)

`WorkspaceProvider` is the source of truth for spaces, trees, tabs, the active page, and running ids.

Persistence (`localStorage`):

- `paper.spaceId`
- `paper.activePageId`
- `paper.tabs`
- `paper.openSpaces`
- `paper.consoleHeight`
- `paper.csvView.${pageId}`
- `paper.chart.${pageId}`

Bootstrap loads those **once** (`booted` ref) and always `pinDesk` so `paper:desk` is first. Closing real tabs never removes it.

`selectPage` / `openGuide` / `openDesk` / `closeTab` are the only ways tabs should change. `closeTab` no-ops on the desk.

Keep-alive: `PageView` renders a pane per tab (`invisible` when inactive) so CodeMirror/TipTap do not remount.

## Markdown

TipTap StarterKit + Typography + Placeholder + custom nodes. Document is stored as **JSON** (`JSON.stringify(editor.getJSON())`), not markdown text. Empty leftover strings are parsed as a paragraph.

`setRunContext(editor, pageId, spaceId)` is a WeakMap so run blocks know where they are without mutating `editor.storage` (lint).

## Code editor

CodeMirror 6 + `@codemirror/lang-javascript` + custom autocomplete (`paper-completions.ts`). Height 100%, scroller overflow, `requestMeasure` after layout.

Do not let CM’s default search panel show; use `FindBar`.

## Runner

`src/main/runner.ts`

1. Sucrase (`typescript` + `imports`, or just `imports`).
2. `vm.runInNewContext` with `console` → log buffer, timers, `require` that resolves sibling pages.
3. Timeout 8s, including thenables.

`run.execute` loads pages across spaces. `import` / `$csv` resolve **same-space** titles unless the spec is `SpaceName/Page title`. Guide runs also inject hidden sample CSVs (`paper:guide:orders`, `paper:guide:products`). If `pageId` is the Guide, it synthesizes a stand-in page.

Secrets bag: current space always; other spaces only if `secretsExposed`. Current space wins key collisions. Installed via `installSecretHelpers` — `$secrets` inspect/toJSON shows names only.

## Secrets storage

`src/main/secrets.ts`

- `enc:` + `safeStorage.encryptString` (base64).
- Refuse to seal if encryption is unavailable.
- Legacy `plain:` can still be unsealed (old rows) but must not be written.

List/create/update **never** return values. Unique key → friendly error.

## Charts

No chart library. SVG in `csv-chart.tsx`, data in `lib/chart-data.ts`.

- Infer column kinds (number / date / text).
- Default X = date or first text, Y = first number, kind = line if X is a date else bar.
- `buildPoints` groups by X and **sums** Y.

Embed attrs: `pageId`, `kind`, `x`, `y`.

## Icons

Allow-list in `src/shared/icons.ts` (`ICON_NAMES`, `ICON_COLOR_IDS`, `ICON_ACCENT`). Lucide map: `lib/lucide-icons.tsx`. Unknown DB values are normalized.

## Theming

CSS variables in `main.css`. Light paper / dark ink. `icon-chip-*` for the ten accent colors. `.accent-select` sets `--page-accent` for selection and charts.

## Layout files

- `App.tsx` — sidebar + paper column (tab strip + page)
- Sidebar header is `h-11` to line up with the tab strip
- Page Markdown column: `max-w-3xl px-10` (title `text-[2.2rem]`)
- Code/CSV toolbars: `border-t`, mono label, accent actions
