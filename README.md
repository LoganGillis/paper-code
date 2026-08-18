# Paper

A Notion-like desktop notebook for Markdown notes and small JavaScript / TypeScript snippets.

Spaces hold folders; folders hold pages. Markdown edits live, like Notion. Code pages run in an isolated main-process VM.

## Layout

```
Space
  Folder
    Page (markdown | javascript | typescript)
    Folder
      Page
```

Pages can also live at the space root.

## Scripts

```bash
pnpm install
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the app with HMR |
| `pnpm db:migrate` | Create / apply Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm rebuild:native` | Rebuild `better-sqlite3` for Electron |

## Writing

- Double-click a tree item to rename it
- `+` in the sidebar creates a page, snippet, or folder in the selected folder
- In Markdown, type `/` at the start of a line for headings, lists, quotes, and code blocks
- On a JS/TS page, **Run** executes the snippet and prints `console` output below

Snippets are scripts: no `import` / `require`, no filesystem. TypeScript is stripped with Sucrase, then run in `vm`.

## Server functions

Add a method to `src/main/procedures.ts` and the matching type on `AppApi` in `src/shared/api.ts`. Call it from the renderer with `api.*`.
