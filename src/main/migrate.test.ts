import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { applySqlMigrations, sqliteFileUrl } from './migrate'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations')
const trashId = '20260819120000_trash_lock_history'

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(
    (row) => row.name
  )
}

/** 0.1.3 dropped every statement chunk that began with a `--` comment, then marked the file applied. */
function applyBroken(db: Database.Database, id: string): void {
  const sql = readFileSync(join(migrationsDir, id, 'migration.sql'), 'utf8')
  const statements = sql
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('--'))
  for (const statement of statements) db.exec(statement)
  db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(id)
}

function applyWholeFile(db: Database.Database, id: string): void {
  db.exec(readFileSync(join(migrationsDir, id, 'migration.sql'), 'utf8'))
  db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(id)
}

function openMigrated(path: string): Database.Database {
  const db = new Database(path)
  db.exec(
    `CREATE TABLE _migrations (id TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
  )
  return db
}

test('sqlite file url keeps a Windows path absolute after the adapter strips file:', () => {
  const url = sqliteFileUrl('C:\\Users\\Logan\\AppData\\Roaming\\Paper\\app.db')
  assert.equal(url, 'file:C:/Users/Logan/AppData/Roaming/Paper/app.db')
  assert.equal(url.replace(/^file:/, ''), 'C:/Users/Logan/AppData/Roaming/Paper/app.db')
})

test('a 0.1.3 database missing deletedAt is repaired and readable by Prisma', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-migrate-'))
  const databasePath = join(dir, 'app.db')
  try {
    const db = openMigrated(databasePath)
    for (const id of readdirSync(migrationsDir)
      .filter((name) => name !== 'migration_lock.toml')
      .sort()) {
      if (id === trashId) applyBroken(db, id)
      else applyWholeFile(db, id)
    }
    assert.equal(columnNames(db, 'Page').includes('deletedAt'), false)
    db.close()

    applySqlMigrations(databasePath, [migrationsDir])

    const check = new Database(databasePath)
    assert.equal(columnNames(check, 'Page').includes('deletedAt'), true)
    assert.equal(columnNames(check, 'Page').includes('locked'), true)
    const version = check
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'PageVersion'`)
      .get()
    const run = check
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'RunRecord'`)
      .get()
    assert.ok(version)
    assert.ok(run)
    check.close()

    const prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: sqliteFileUrl(databasePath) })
    })
    try {
      const pages = await prisma.page.findMany()
      assert.equal(pages.length, 0)
    } finally {
      await prisma.$disconnect()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('repair adds deletedAt when the migration directory is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-migrate-'))
  const databasePath = join(dir, 'app.db')
  try {
    const db = openMigrated(databasePath)
    for (const id of readdirSync(migrationsDir)
      .filter((name) => name !== 'migration_lock.toml')
      .sort()) {
      if (id === trashId) applyBroken(db, id)
      else applyWholeFile(db, id)
    }
    db.close()

    applySqlMigrations(databasePath, [join(dir, 'missing-migrations')])

    const check = new Database(databasePath)
    assert.equal(columnNames(check, 'Page').includes('deletedAt'), true)
    assert.ok(check.prepare(`SELECT name FROM sqlite_master WHERE name = 'PageVersion'`).get())
    check.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CRLF migration files still add deletedAt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-migrate-'))
  const databasePath = join(dir, 'app.db')
  const crlfDir = join(dir, 'migrations')
  try {
    for (const id of readdirSync(migrationsDir).filter((name) => name !== 'migration_lock.toml')) {
      const sql = readFileSync(join(migrationsDir, id, 'migration.sql'), 'utf8').replace(
        /\n/g,
        '\r\n'
      )
      mkdirSync(join(crlfDir, id), { recursive: true })
      writeFileSync(join(crlfDir, id, 'migration.sql'), sql)
    }

    const db = openMigrated(databasePath)
    for (const id of readdirSync(migrationsDir)
      .filter((name) => name !== 'migration_lock.toml')
      .sort()) {
      if (id === trashId) applyBroken(db, id)
      else applyWholeFile(db, id)
    }
    db.close()

    applySqlMigrations(databasePath, [crlfDir])

    const check = new Database(databasePath)
    assert.equal(columnNames(check, 'Page').includes('deletedAt'), true)
    check.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
