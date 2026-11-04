import { describe, expect, it } from 'vitest'
import { clearRunDraft, runSourceFor, setRunDraft } from './run-drafts'

describe('run drafts', () => {
  it('runs the unsaved buffer instead of the saved content', () => {
    expect(runSourceFor('p1', 'saved')).toBe('saved')
    setRunDraft('p1', 'buffer')
    expect(runSourceFor('p1', 'saved')).toBe('buffer')
  })

  it('keeps a newer buffer when an older save lands', () => {
    setRunDraft('p2', 'v2')
    clearRunDraft('p2', 'v1')
    expect(runSourceFor('p2', 'v1')).toBe('v2')
    clearRunDraft('p2', 'v2')
    expect(runSourceFor('p2', 'v2')).toBe('v2')
    setRunDraft('p2', 'v3')
    clearRunDraft('p2')
    expect(runSourceFor('p2', 'saved')).toBe('saved')
  })
})
