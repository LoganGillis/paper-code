import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'

/** Adapter strips a single `file:` prefix and opens the rest as a filesystem path. */
export function sqliteFileUrl(databasePath: string): string {
  return `file:${databasePath.replace(/\\/g, '/')}`
}

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name) as { name: string } | undefined
  return Boolean(row)
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
  return rows.some((row) => row.name === column)
}

function forgetMigration(db: Database.Database, applied: Set<string>, id: string): void {
  db.prepare('DELETE FROM _migrations WHERE id = ?').run(id)
  applied.delete(id)
}

function addColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  if (!tableExists(db, table) || columnExists(db, table, column)) return
  db.exec(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`)
}

/** Columns and tables the client selects. 0.1.3 skipped any SQL chunk that started with `--`. */
function ensureSchema(db: Database.Database): void {
  addColumn(db, 'Space', 'iconColor', `"iconColor" TEXT NOT NULL DEFAULT 'slate'`)
  addColumn(db, 'Space', 'secretsExposed', `"secretsExposed" BOOLEAN NOT NULL DEFAULT 0`)
  addColumn(db, 'Folder', 'icon', `"icon" TEXT NOT NULL DEFAULT 'Folder'`)
  addColumn(db, 'Folder', 'iconColor', `"iconColor" TEXT NOT NULL DEFAULT 'slate'`)
  addColumn(db, 'Page', 'description', `"description" TEXT NOT NULL DEFAULT ''`)
  addColumn(db, 'Page', 'icon', `"icon" TEXT NOT NULL DEFAULT 'FileText'`)
  addColumn(db, 'Page', 'iconColor', `"iconColor" TEXT NOT NULL DEFAULT 'slate'`)
  addColumn(db, 'Page', 'archived', `"archived" BOOLEAN NOT NULL DEFAULT 0`)
  addColumn(db, 'Page', 'deletedAt', `"deletedAt" DATETIME`)
  addColumn(db, 'Page', 'locked', `"locked" BOOLEAN NOT NULL DEFAULT 0`)
  addColumn(db, 'Page', 'spellcheck', `"spellcheck" BOOLEAN NOT NULL DEFAULT 1`)

  if (tableExists(db, 'Page') && !tableExists(db, 'PageVersion')) {
    db.exec(`
      CREATE TABLE "PageVersion" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "pageId" TEXT NOT NULL,
        CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
  }
  if (tableExists(db, 'Page') && !tableExists(db, 'RunRecord')) {
    db.exec(`
      CREATE TABLE "RunRecord" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "language" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "logs" TEXT NOT NULL DEFAULT '[]',
        "result" TEXT,
        "error" TEXT,
        "inputs" TEXT NOT NULL DEFAULT '{}',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "pageId" TEXT NOT NULL,
        CONSTRAINT "RunRecord_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
  }
  if (tableExists(db, 'PageVersion')) {
    db.exec(
      `CREATE INDEX IF NOT EXISTS "PageVersion_pageId_createdAt_idx" ON "PageVersion"("pageId", "createdAt")`
    )
  }
  if (tableExists(db, 'RunRecord')) {
    db.exec(
      `CREATE INDEX IF NOT EXISTS "RunRecord_pageId_createdAt_idx" ON "RunRecord"("pageId", "createdAt")`
    )
  }
}

function pageReady(db: Database.Database): boolean {
  return (
    tableExists(db, 'Page') &&
    columnExists(db, 'Page', 'deletedAt') &&
    tableExists(db, 'PageVersion')
  )
}

function applyDir(db: Database.Database, migrationsDir: string, applied: Set<string>): void {
  const directories = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const id of directories) {
    if (applied.has(id)) continue

    const sqlPath = join(migrationsDir, id, 'migration.sql')
    if (!existsSync(sqlPath)) continue

    const statements = readFileSync(sqlPath, 'utf8')
      .split(';')
      .map((part) => stripSqlComments(part))
      .filter((part) => part.length > 0)
    for (const statement of statements) {
      try {
        db.exec(statement)
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        if (!/duplicate column name|already exists/i.test(message)) throw cause
      }
    }
    db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(id)
    applied.add(id)
  }
}

export function applySqlMigrations(
  databasePath: string,
  migrationsDirs: string[],
  nativeBinding?: string
): void {
  mkdirSync(dirname(databasePath), { recursive: true })

  const db = new Database(databasePath, nativeBinding ? { nativeBinding } : {})
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const applied = new Set(
      (db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map((row) => row.id)
    )

    // 0.1.3 recorded Prisma files as applied while skipping `-- CreateTable` / `-- AlterTable` bodies.
    if (!tableExists(db, 'Space')) {
      db.exec('DELETE FROM _migrations')
      applied.clear()
    } else if (tableExists(db, 'Page') && !columnExists(db, 'Page', 'deletedAt')) {
      forgetMigration(db, applied, '20260819120000_trash_lock_history')
    }

    let replayError: unknown = null
    try {
      for (const migrationsDir of migrationsDirs) {
        if (!existsSync(migrationsDir)) continue
        applyDir(db, migrationsDir, applied)
      }
    } catch (cause) {
      replayError = cause
    }

    ensureSchema(db)
    if (replayError && !pageReady(db)) throw replayError
  } finally {
    db.close()
  }
}
