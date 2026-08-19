import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Page } from '../api'
import { resolvePage, splitImportSpec } from './csv'

function page(input: Partial<Page> & Pick<Page, 'id' | 'title' | 'spaceId'>): Page {
  return {
    type: 'csv',
    folderId: null,
    sortOrder: 0,
    archived: false,
    icon: 'Table2',
    iconColor: 'slate',
    content: 'a,b\n1,2\n',
    description: '',
    createdAt: '',
    updatedAt: '',
    ...input
  }
}

test('splitImportSpec treats a slash as space/title', () => {
  assert.deepEqual(splitImportSpec('orders'), { spaceName: null, title: 'orders' })
  assert.deepEqual(splitImportSpec('./orders.csv'), { spaceName: null, title: 'orders.csv' })
  assert.deepEqual(splitImportSpec('Workshop/orders'), {
    spaceName: 'Workshop',
    title: 'orders'
  })
})

test('resolvePage stays in the current space unless a space is named', () => {
  const here = page({ id: 'script', title: 'script', spaceId: 'workshop', type: 'javascript' })
  const local = page({ id: 'orders', title: 'orders', spaceId: 'workshop' })
  const other = page({ id: 'other-orders', title: 'orders', spaceId: 'archive' })
  const pages = [here, local, other]
  const spaces = [
    { id: 'workshop', name: 'Workshop' },
    { id: 'archive', name: 'Archive' }
  ]

  assert.equal(resolvePage('orders', here, pages, spaces)?.id, 'orders')
  assert.equal(resolvePage('Archive/orders', here, pages, spaces)?.id, 'other-orders')
  assert.equal(resolvePage('Missing/orders', here, pages, spaces), null)
})

test('resolvePage prefers the same folder and skips archived pages', () => {
  const here = page({
    id: 'script',
    title: 'script',
    spaceId: 'workshop',
    folderId: 'folder-a',
    type: 'javascript'
  })
  const nested = page({
    id: 'near',
    title: 'sales',
    spaceId: 'workshop',
    folderId: 'folder-a'
  })
  const root = page({ id: 'far', title: 'sales', spaceId: 'workshop', folderId: null })
  const archived = page({
    id: 'old',
    title: 'sales',
    spaceId: 'workshop',
    folderId: 'folder-a',
    archived: true
  })

  assert.equal(resolvePage('sales', here, [here, root, nested, archived])?.id, 'near')
})
