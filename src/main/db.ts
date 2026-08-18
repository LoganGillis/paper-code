import { mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

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

  const db = new Database(databasePath)
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

    db.exec(readFileSync(sqlPath, 'utf8'))
    db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(id)
  }

  db.close()
}

export function getPrisma(): PrismaClient {
  if (prisma) return prisma

  const databasePath = getDatabasePath()
  applyMigrations(databasePath)

  const adapter = new PrismaBetterSqlite3({ url: `file:${databasePath}` })
  prisma = new PrismaClient({ adapter })
  return prisma
}
