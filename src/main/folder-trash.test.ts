import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'
import { applySqlMigrations, sqliteFileUrl } from './migrate'
import { assertFolderMove, trashFolderTree } from './page-rules'

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

test('deleting a folder with a locked page inside refuses and changes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-folder-lock-'))
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
    await prisma.page.create({
      data: { title: 'Free', type: 'markdown', spaceId: space.id, folderId: top.id }
    })
    await prisma.page.create({
      data: {
        title: 'Keep me',
        type: 'markdown',
        spaceId: space.id,
        folderId: child.id,
        locked: true
      }
    })

    await assert.rejects(
      prisma.$transaction((tx) => trashFolderTree(tx, top.id, new Date())),
      /"Top" has a locked page, "Keep me"/
    )
    const pages = await prisma.page.findMany()
    assert.equal(pages.filter((page) => page.deletedAt).length, 0)
    assert.equal((await prisma.folder.findMany()).length, 2)
  } finally {
    await prisma.$disconnect()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a locked page already in the trash does not stop its old folder being deleted', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-folder-trashed-lock-'))
  const databasePath = join(dir, 'app.db')
  applySqlMigrations(databasePath, [migrationsDir])
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: sqliteFileUrl(databasePath) })
  })
  try {
    const space = await prisma.space.create({ data: { name: 'Workshop' } })
    const top = await prisma.folder.create({ data: { name: 'Top', spaceId: space.id } })
    const trashed = await prisma.page.create({
      data: {
        title: 'Old',
        type: 'markdown',
        spaceId: space.id,
        folderId: top.id,
        locked: true,
        deletedAt: new Date()
      }
    })
    const free = await prisma.page.create({
      data: { title: 'Free', type: 'markdown', spaceId: space.id, folderId: top.id }
    })

    await prisma.$transaction((tx) => trashFolderTree(tx, top.id, new Date()))

    assert.equal((await prisma.folder.findMany()).length, 0)
    const old = await prisma.page.findUniqueOrThrow({ where: { id: trashed.id } })
    assert.ok(old.deletedAt, 'the locked page stays in the trash')
    assert.equal(old.locked, true)
    const moved = await prisma.page.findUniqueOrThrow({ where: { id: free.id } })
    assert.ok(moved.deletedAt, 'the free page is trashed with the folder')
  } finally {
    await prisma.$disconnect()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a folder cannot move into itself, a subfolder, or another space', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-folder-move-'))
  const databasePath = join(dir, 'app.db')
  applySqlMigrations(databasePath, [migrationsDir])
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: sqliteFileUrl(databasePath) })
  })
  try {
    const space = await prisma.space.create({ data: { name: 'Workshop' } })
    const other = await prisma.space.create({ data: { name: 'Other' } })
    const top = await prisma.folder.create({ data: { name: 'Top', spaceId: space.id } })
    const child = await prisma.folder.create({
      data: { name: 'Child', spaceId: space.id, parentId: top.id }
    })
    const grandchild = await prisma.folder.create({
      data: { name: 'Grandchild', spaceId: space.id, parentId: child.id }
    })
    const sibling = await prisma.folder.create({ data: { name: 'Sibling', spaceId: space.id } })
    const elsewhere = await prisma.folder.create({ data: { name: 'Away', spaceId: other.id } })

    const move = (parentId: string | null): Promise<unknown> =>
      prisma.$transaction((tx) => assertFolderMove(tx, top, parentId))
    await assert.rejects(move(top.id), /cannot go inside itself/)
    await assert.rejects(move(child.id), /one of its own subfolders/)
    await assert.rejects(move(grandchild.id), /one of its own subfolders/)
    await assert.rejects(move(elsewhere.id), /same space/)
    await assert.rejects(move('missing'), /same space/)
    await move(sibling.id)
    await move(null)
    await prisma.$transaction((tx) => assertFolderMove(tx, grandchild, top.id))
  } finally {
    await prisma.$disconnect()
    rmSync(dir, { recursive: true, force: true })
  }
})
