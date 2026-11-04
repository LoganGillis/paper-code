import { describe, expect, it, vi } from 'vitest'
import { makePage } from '../shared/test-fixtures'

const executeSnippet = vi.fn()
vi.mock('./runner', () => ({ executeSnippet }))

const { executeSnippetAsync } = await import('./run-pool')

describe('executeSnippetAsync', () => {
  it('reports a run error and never runs the script in this process when the worker is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const page = makePage({ id: 'p', title: 'p', spaceId: 's', type: 'javascript' })
    const result = await executeSnippetAsync('javascript', 'console.log(1)', { page, pages: [] })
    expect(result.error).toMatch(/script runner/i)
    expect(result.logs).toEqual([])
    expect(executeSnippet).not.toHaveBeenCalled()
  })
})
