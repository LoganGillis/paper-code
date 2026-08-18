# Paper

A desktop notebook for notes, tables, and scripts. Electron, not a website.

Spaces hold folders and pages. Pages are Markdown, JavaScript, TypeScript, or CSV. Scripts run in a main-process VM with a small `$` standard library. Secrets stay sealed in the OS keychain.

## Run

```bash
pnpm install
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | App with HMR (renderer). Main-process changes need a restart. |
| `pnpm typecheck` | Node + web TypeScript |
| `pnpm db:migrate` | Prisma migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm rebuild:native` | Rebuild `better-sqlite3` for this Electron ABI |

Dev database: `prisma/dev.db`. Production uses the app userData directory.

## Docs

| File | What’s in it |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | How to change the app without breaking it |
| [docs/product.md](./docs/product.md) | Features, UX decisions, shortcuts |
| [docs/architecture.md](./docs/architecture.md) | Process split, IPC, data, runner |
| [docs/helpers.md](./docs/helpers.md) | The `$` library scripts get |

Installers and updates: [docs/release.md](./docs/release.md).

Remote: `git@personal:LoganGillis/paper-code.git`
