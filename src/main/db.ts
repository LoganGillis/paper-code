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
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !part.startsWith('--'))
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
