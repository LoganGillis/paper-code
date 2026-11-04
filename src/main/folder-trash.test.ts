import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { applySqlMigrations, sqliteFileUrl } from './migrate'
import { trashFolderTree } from './page-rules'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations')

test('deleting a folder trashes its pages and subfolder pages in one transaction', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-folder-trash-'))
  const databasePath = join(dir, 'app.db')
  applySqlMigrations(databasePath, [migrationsDir])
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: sqliteFileUrl(databasePath) })
  })
  try {
    const space = await prisma.space.create({ data: { name: 'Workshop' } })
    const top = await prisma.folder.create({ data: { name: 'Top', spaceId: space.id } })
    const child = await prisma.folder.create({
      data: { name: 'Child', spaceId: space.id, parentId: top.id }
    })
    const keep = await prisma.folder.create({ data: { name: 'Keep', spaceId: space.id } })
    const page = (title: string, folderId: string | null): Promise<{ id: string }> =>
      prisma.page.create({ data: { title, type: 'markdown', spaceId: space.id, folderId } })
    const a = await page('A', top.id)
    const b = await page('B', child.id)
    const c = await page('C', keep.id)

    await prisma.$transaction((tx) => trashFolderTree(tx, top.id, new Date()))

    const rows = await prisma.page.findMany({ orderBy: { title: 'asc' } })
    assert.equal(rows.length, 3)
    for (const row of rows.filter((item) => item.id === a.id || item.id === b.id)) {
      assert.ok(row.deletedAt, `${row.title} is in the trash`)
      assert.equal(row.folderId, null)
    }
    const kept = rows.find((item) => item.id === c.id)
    assert.equal(kept?.deletedAt, null)
    assert.equal(kept?.folderId, keep.id)
    const folders = await prisma.folder.findMany()
    assert.deepEqual(
      folders.map((folder) => folder.name),
      ['Keep']
    )

    await assert.rejects(prisma.$transaction((tx) => trashFolderTree(tx, 'missing', new Date())))
    assert.equal((await prisma.page.findMany({ where: { deletedAt: null } })).length, 1)
  } finally {
    await prisma.$disconnect()
    rmSync(dir, { recursive: true, force: true })
  }
})
