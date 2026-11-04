import { describe, expect, it, vi } from 'vitest'
import { undoWrite, type UndoWrite } from './undo-write'

function setup(current: string): UndoWrite & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    current: () => current,
    applied: 'formatted',
    previous: 'original',
    cancelPending: vi.fn(() => void calls.push('cancel')),
    apply: vi.fn((text: string) => void calls.push(`apply ${text}`)),
    save: vi.fn(async (text: string) => void calls.push(`save ${text}`))
  }
}

describe('undoWrite', () => {
  it('cancels the pending save, then restores and saves the previous text', async () => {
    const undo = setup('formatted')
    expect(await undoWrite(undo)).toBe(true)
    expect(undo.calls).toEqual(['cancel', 'apply original', 'save original'])
  })

  it('does nothing once the user has typed since', async () => {
    const undo = setup('formatted plus typing')
    expect(await undoWrite(undo)).toBe(false)
    expect(undo.calls).toEqual([])
  })
})
