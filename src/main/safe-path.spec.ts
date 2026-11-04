import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { isInside, resolveInside } from './safe-path'

let root = ''
let outside = ''

beforeAll(async () => {
  const base = await mkdtemp(join(tmpdir(), 'paper-safe-path-'))
  root = join(base, 'export')
  outside = join(base, 'secret.txt')
  await mkdir(join(root, 'Notes'), { recursive: true })
  await writeFile(join(root, 'Notes', 'a.md'), 'a')
  await writeFile(outside, 'nope')
  await symlink(outside, join(root, 'link.md'))
})

describe('isInside', () => {
  it('compares resolved paths, not strings', () => {
    expect(isInside('/a/b', '/a/b/c')).toBe(true)
    expect(isInside('/a/b', '/a/b')).toBe(true)
    expect(isInside('/a/b', '/a/bc')).toBe(false)
    expect(isInside('/a/b', '/a')).toBe(false)
    expect(isInside('/a/b', '/a/b/..notes')).toBe(true)
  })
})

describe('resolveInside', () => {
  it('accepts files inside the export folder', async () => {
    await expect(resolveInside(root, 'Notes/a.md')).resolves.toBe(join(root, 'Notes', 'a.md'))
  })

  it('rejects traversal and absolute paths', async () => {
    await expect(resolveInside(root, '../secret.txt')).rejects.toThrow(/outside/)
    await expect(resolveInside(root, 'Notes/../../secret.txt')).rejects.toThrow(/outside/)
    await expect(resolveInside(root, outside)).rejects.toThrow(/outside/)
  })

  it('rejects a symlink that leaves the folder', async () => {
    await expect(resolveInside(root, 'link.md')).rejects.toThrow(/outside/)
  })
})
