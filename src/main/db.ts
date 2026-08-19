import { mkdirSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const require = createRequire(import.meta.url)

function existingFile(path: string): string | null {
  try {
    const stat = statSync(path)
    return stat.isFile() && stat.size > 0 ? path : null
  } catch {
    return null
  }
}

/** asar stores a 0-byte stub; load the real addon from app.asar.unpacked. */
function resolveSqliteNativeBinding(): string {
  const file = 'better_sqlite3.node'
  const rel = join('node_modules', 'better-sqlite3', 'build', 'Release', file)
  const candidates: string[] = []

  if (app.isPackaged) {
    candidates.push(join(process.resourcesPath, 'better_sqlite3.node'))
    candidates.push(join(process.resourcesPath, 'app.asar.unpacked', rel))
  }

  try {
    const pkgDir = dirname(require.resolve('better-sqlite3/package.json'))
    candidates.push(join(pkgDir, 'build', 'Release', file))
    if (pkgDir.includes('app.asar')) {
      candidates.push(join(pkgDir.replace('app.asar', 'app.asar.unpacked'), 'build', 'Release', file))
    }
  } catch {
    // resolved below
  }

  for (const path of candidates) {
    const found = existingFile(path)
    if (found) return found
  }

  throw new Error(`SQLite native addon missing (tried ${candidates.join(', ') || 'nothing'})`)
}

let prisma: PrismaClient | null = null

export function getDatabasePath(): string {
  if (is.dev) {
    return join(process.cwd(), 'prisma', 'dev.db')
  }

  return join(app.getPath('userData'), 'app.db')
}

function getMigrationsDir(): string {
  if (is.dev) {
    return join(process.cwd(), 'prisma', 'migrations')
  }

  return join(process.resourcesPath, 'prisma', 'migrations')
}

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name) as
    | { name: string }
    | undefined
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

function applyMigrations(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true })

  const db = new Database(databasePath, { nativeBinding: resolveSqliteNativeBinding() })
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

  const migrationsDir = getMigrationsDir()
  if (!existsSync(migrationsDir)) {
    db.close()
    return
  }

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
  }

  if (tableExists(db, 'Page')) {
    const addColumn = (column: string, ddl: string): void => {
      if (columnExists(db, 'Page', column)) return
      db.exec(`ALTER TABLE "Page" ADD COLUMN ${ddl}`)
    }
    addColumn('deletedAt', '"deletedAt" DATETIME')
    addColumn('locked', '"locked" BOOLEAN NOT NULL DEFAULT 0')
    addColumn('spellcheck', '"spellcheck" BOOLEAN NOT NULL DEFAULT 1')
  }

  db.close()
}

export function getPrisma(): PrismaClient {
  if (prisma) return prisma

  const databasePath = getDatabasePath()
  applyMigrations(databasePath)

  const adapter = new PrismaBetterSqlite3({
    url: `file:${databasePath}`,
    nativeBinding: resolveSqliteNativeBinding()
  })
  prisma = new PrismaClient({ adapter })
  return prisma
}
