import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'

/** Adapter strips a single `file:` prefix and opens the rest as a filesystem path. */
export function sqliteFileUrl(databasePath: string): string {
  return `file:${databasePath.replace(/\\/g, '/')}`
}

const LEGACY_REPLAY = /duplicate column name|already exists/i

/**
 * Splits SQL into statements on `;`, ignoring semicolons inside quotes and comments, and drops
 * comment-only chunks. Used only to replay a migration on a database that 0.1.3 half-applied.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let index = 0
  while (index < sql.length) {
    const char = sql[index]
    const next = sql[index + 1]
    if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', index)
      index = end === -1 ? sql.length : end + 1
      current += '\n'
      continue
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2)
      index = end === -1 ? sql.length : end + 2
      current += ' '
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      let end = index + 1
      while (end < sql.length) {
        if (sql[end] === char) {
          if (sql[end + 1] === char) end += 2
          else break
        } else end += 1
      }
      current += sql.slice(index, end + 1)
      index = end + 1
      continue
    }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
      index += 1
      continue
    }
    current += char
    index += 1
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

const unquote = (name: string): string => name.replace(/^["`[]|["`\]]$/g, '').toLowerCase()

/**
 * True only for the one known 0.1.3 case: `statement` creates a table or index, or adds a
 * column, and `message` is SQLite saying that exact table, index, or column already exists.
 */
export function isAlreadyAppliedStep(statement: string, message: string): boolean {
  const sql = statement.replace(/\s+/g, ' ').trim()
  const create = /^CREATE (?:UNIQUE )?(TABLE|INDEX) (?:IF NOT EXISTS )?("[^"]+"|`[^`]+`|\S+)/i.exec(
    sql
  )
  const exists = /^(table|index) ("[^"]+"|`[^`]+`|\S+) already exists$/i.exec(message.trim())
  if (create && exists) {
    return (
      create[1].toLowerCase() === exists[1].toLowerCase() &&
      unquote(create[2]) === unquote(exists[2])
    )
  }
  const add = /^ALTER TABLE \S+ ADD (?:COLUMN )?("[^"]+"|`[^`]+`|\S+)/i.exec(sql)
  const duplicate = /^duplicate column name: (\S+)$/i.exec(message.trim())
  return Boolean(add && duplicate && unquote(add[1]) === unquote(duplicate[1]))
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Runs one migration file. The whole file runs at once; only if a 0.1.3 database already has
 * some of its tables or columns is it replayed statement by statement, skipping just those.
 */
function runMigrationSql(db: Database.Database, id: string, sql: string): void {
  db.exec('SAVEPOINT paper_migration')
  try {
    db.exec(sql)
    db.exec('RELEASE paper_migration')
    return
  } catch (cause) {
    db.exec('ROLLBACK TO paper_migration')
    db.exec('RELEASE paper_migration')
    if (!LEGACY_REPLAY.test(messageOf(cause))) throw cause
  }
  for (const statement of splitSqlStatements(sql)) {
    try {
      db.exec(statement)
    } catch (cause) {
      if (!isAlreadyAppliedStep(statement, messageOf(cause))) throw cause
      console.warn(`Migration ${id}: skipped a step that was already applied (${messageOf(cause)})`)
    }
  }
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

    const sql = readFileSync(sqlPath, 'utf8')
    // One transaction per migration: it is either fully applied and recorded, or not at all.
    db.transaction(() => {
      runMigrationSql(db, id, sql)
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(id)
    })()
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

    // PRAGMA foreign_keys is ignored inside a transaction, so table rebuilds would cascade.
    const foreignKeys = db.pragma('foreign_keys', { simple: true })
    db.pragma('foreign_keys = OFF')
    let replayError: unknown = null
    try {
      for (const migrationsDir of migrationsDirs) {
        if (!existsSync(migrationsDir)) continue
        applyDir(db, migrationsDir, applied)
      }
    } catch (cause) {
      replayError = cause
    } finally {
      const broken = db.pragma('foreign_key_check') as unknown[]
      if (broken.length > 0) console.warn(`Migrations left ${broken.length} dangling references`)
      db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`)
    }

    ensureSchema(db)
    if (replayError) {
      // A 0.1.3 database can be repaired by ensureSchema; anything else stops the launch.
      if (!pageReady(db)) throw replayError
      console.error('A migration failed; the schema was repaired instead', replayError)
    }
  } finally {
    db.close()
  }
}
