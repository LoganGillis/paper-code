# Agent notes

Read this before changing Paper. Longer product and architecture notes live in `docs/`.

## What this is

An Electron desktop notebook (`electron-vite`). Not Next.js. Not a web SaaS.

- **Main** (`src/main`) — window, menu, Prisma/SQLite, runner, secret sealing, RPC
- **Preload** (`src/preload`) — `window.api.invoke`
- **Renderer** (`src/renderer`) — React UI
- **Shared** (`src/shared`) — types, CSV parse, `$` helpers, icons

Add a server method in `src/main/procedures.ts` **and** the matching type on `AppApi` in `src/shared/api.ts`, then call it with `api.*` from `src/renderer/src/lib/rpc.ts`.

## Rules of the house

- Match existing UI: quiet paper chrome, shadcn/Radix, space/page **icon accent**, official `Button` / `Kbd` / `KbdGroup`.
- Keep comments short and only for non-obvious constraints. No narrative comments.
- Do not invent extra `$` categories or Guide sections unless asked.
- Do not put secrets back in Settings. They belong on the **space** menu.
- Do not store secret values in the renderer, logs, or localStorage.
- Do not fall back to plaintext if `safeStorage` is unavailable.
- Virtual pages (`paper:guide`, `paper:desk`, `paper:guide:orders`, `paper:guide:products`) are not in the user tree. Guide sample CSVs are hidden and must keep working after the user deletes seed data.
- The desk is a single **pinned** root tab (icon only, cannot close). Do not create a desk per space.
- Opening a page replaces the current tab unless the user middle-clicks or chooses **Open in new tab**. `⌘1`–`⌘9` skip the desk.
- Renderer HMR does not reload main. After RPC, runner, sealing, or window options change, restart `pnpm dev`.
- After Prisma schema changes: migrate, `pnpm db:generate`, rebuild native if the client ABI shifted.

## Do not re-introduce

A click-drag **multi-block Markdown selection** (including custom nodes) was added and explicitly reverted. Leave selection as TipTap/ProseMirror default unless the user asks again.

## Where things live

| Concern | Start here |
| --- | --- |
| Window, menu, Cmd+W, app name | `src/main/index.ts` |
| Auto-update | `src/main/updates.ts`, Settings → Updates |
| Installers / identity | `electron-builder.yml`, `docs/release.md` |
| RPC handlers | `src/main/procedures.ts` |
| Script VM | `src/main/runner.ts` |
| Seal / unseal / `$secret` | `src/main/secrets.ts` |
| Seed + helper demos | `src/main/seed.ts`, `src/main/helper-demos.ts` |
| Workspace state, tabs, virtual pages | `src/renderer/src/lib/workspace.tsx` |
| Guide content | `src/renderer/src/lib/guide.ts` |
| Desk / daily notes | `src/renderer/src/lib/desk.ts`, `desk-blotter.tsx` |
| Markdown + slash | `markdown-editor.tsx` |
| Custom MD nodes | `md-run-block.tsx`, `md-csv-embed.tsx`, `md-chart-embed.tsx`, `md-page-link.tsx` |
| CSV grid / chart | `csv-editor.tsx`, `csv-chart.tsx`, `lib/chart-data.ts` |
| Completions | `lib/paper-completions.ts`, `shared/helpers/docs.ts` |
| Secrets UI | `secrets-dialog.tsx`, space `ItemMenu` |
| Title bar / tabs | `tab-bar.tsx`, `sidebar.tsx` header (`app-drag`), `titleBarStyle: hiddenInset` |

## Virtual page IDs

- `paper:guide` — built-in Guide, Markdown, read-only, BookOpen / slate
- `paper:desk` — one root Desk, House / slate, always first in the tab strip

`selectPage` must branch on these **before** any database fetch. `validTabs` may keep a guide tab even if its host space is gone. The desk tab is always pinned via `pinDesk`.

## Runner

`sucrase` then `vm.runInNewContext` (8s timeout). Same-space `import` / `require` resolve pages by title (CSV → `$Table`). Injected: date helpers, CSV helpers, `$secret` / `$secrets`.

`$Table` is a **wrapper + Proxy**, not an `Array` subclass (`sort` / `fill` / `concat` clash).

## Completions

- `DATE_ROOTS` / `TABLE_ROOTS` / `SECRET_ROOTS` are separate. Do not treat every `$` as a date.
- `$csv("…")` path completions cannot live behind `ifNotIn(String)` or quotes will block them.

## Native / Prisma

- Prisma 7 client output: `src/generated/prisma` (gitignored).
- SQLite via `better-sqlite3`. Must be rebuilt for the **Electron** ABI, not system Node (`pnpm rebuild:native`). Packaged apps load `resources/better_sqlite3.node` (`nativeBinding` in `db.ts`) — asar stores a 0-byte stub. `before-pack.cjs` rebuilds for the host OS or downloads a matching prebuild when cross-packing Windows from macOS; `after-pack.cjs` copies the binary next to the app resources.
- Electron is ABI 140 as of this writing; a stale Prisma client looks like missing models/fields.

## Main-process menu

- Close Tab: `CmdOrCtrl+W` (also `before-input-event` + `paper:close-tab`)
- Close Window: `CmdOrCtrl+Shift+W`
- When sending to `webContents`, check `instanceof BrowserWindow` — `BaseWindow` has no `webContents`.
