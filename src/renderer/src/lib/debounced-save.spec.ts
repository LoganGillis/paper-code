import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { createDebouncer } from './debounced-save'
import { replaceDocSpec } from './editor-jump'

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves only the latest content after a pause', () => {
    const save = vi.fn()
    const saver = createDebouncer(400)
    saver.run(() => save('a'))
    saver.run(() => save('b'))
    vi.advanceTimersByTime(399)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('cancel drops a pending save, so Undo is not overwritten by the formatted text', () => {
    const save = vi.fn()
    const saver = createDebouncer(400)
    saver.run(() => save('formatted'))
    saver.cancel()
    vi.advanceTimersByTime(1000)
    expect(save).not.toHaveBeenCalled()
    saver.run(() => save('typed later'))
    vi.advanceTimersByTime(400)
    expect(save).toHaveBeenCalledExactlyOnceWith('typed later')
  })

  it('flush saves the pending edit to its own page now, so switching pages keeps it', () => {
    const save = vi.fn()
    const saver = createDebouncer(400)
    saver.run(() => save('page-a', 'last keystrokes'))
    saver.flush()
    expect(save).toHaveBeenCalledExactlyOnceWith('page-a', 'last keystrokes')
    vi.advanceTimersByTime(1000)
    saver.flush()
    expect(save).toHaveBeenCalledOnce()
  })
})

describe('replaceDocSpec', () => {
  it('replaces the whole document, even with text the editor showed before', () => {
    const original = '{"a":1}'
    let state = EditorState.create({ doc: original })
    state = state.update(replaceDocSpec(state, '{\n  "a": 1\n}\n')!).state
    const back = replaceDocSpec(state, original)
    expect(back).not.toBeNull()
    expect(state.update(back!).state.doc.toString()).toBe(original)
  })

  it('does nothing when the text already matches', () => {
    expect(replaceDocSpec(EditorState.create({ doc: 'x' }), 'x')).toBeNull()
  })
})
