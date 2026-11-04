import { describe, expect, it } from 'vitest'
import { makePage } from '../shared/test-fixtures'
import { executeSnippet } from './runner'

const spaces = [{ id: 'ws', name: 'Workshop' }]
const folders = [{ id: 'reports', name: 'Reports', parentId: null, spaceId: 'ws' }]
const script = makePage({ id: 'script', title: 'script', spaceId: 'ws', type: 'javascript' })
const pages = [
  makePage({ id: 'j1', title: 'Data', spaceId: 'ws', type: 'json', content: '{"at":"root"}' }),
  makePage({
    id: 'j2',
    title: 'Data',
    spaceId: 'ws',
    type: 'json',
    folderId: 'reports',
    content: '{"at":"reports"}'
  }),
  makePage({ id: 'c1', title: 'Data', spaceId: 'ws', type: 'csv', content: 'n\n1\n2\n' })
]

function run(source: string): ReturnType<typeof executeSnippet> {
  return executeSnippet('javascript', source, { page: script, pages, spaces, folders })
}

describe('runner page resolution', () => {
  it('$csv ignores same-titled JSON pages', async () => {
    expect((await run('$csv("Data").length')).result).toBe('2')
  })

  it('$json and require throw the ambiguity error with full paths', async () => {
    const message =
      '"Data" matches 2 JSON pages. Use the full path: "Workshop//Data", "Workshop/Reports/Data"'
    expect((await run('$json("Data")')).error).toBe(message)
    expect((await run('require("Data")')).error).toMatch(/matches 3 importable pages/)
  })

  it('$json, $csv, and require accept Space/Folder/Title', async () => {
    expect((await run('$json("Workshop/Reports/Data").at')).result).toBe('reports')
    expect((await run('$json("Workshop//Data").at')).result).toBe('root')
    expect((await run('require("Workshop/Reports/Data").at')).result).toBe('reports')
    expect((await run('$csv("Workshop//Data").length')).result).toBe('2')
  })
})
