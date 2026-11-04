import type { EditorState, TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { ExternalChange } from '@uiw/react-codemirror'

/** Moves the cursor to `offset`, scrolls it into view, and focuses the editor. */
export function jumpTo(view: EditorView | null, offset: number): void {
  if (!view) return
  const anchor = Math.max(0, Math.min(offset, view.state.doc.length))
  view.dispatch({ selection: { anchor }, scrollIntoView: true })
  view.focus()
}

/**
 * The transaction that replaces the whole document with `text`, or null when it already matches.
 * It is marked as an outside change, so the editor's onChange does not fire for it.
 */
export function replaceDocSpec(state: EditorState, text: string): TransactionSpec | null {
  if (state.doc.toString() === text) return null
  return {
    changes: { from: 0, to: state.doc.length, insert: text },
    annotations: [ExternalChange.of(true)]
  }
}

/**
 * Puts `text` in the editor now. The `value` prop alone can lag: CodeMirror holds outside updates
 * while it thinks the user is typing, so Undo and Format write to the view directly.
 */
export function replaceDoc(view: EditorView | null, text: string): void {
  if (!view) return
  const spec = replaceDocSpec(view.state, text)
  if (spec) view.dispatch(spec)
}
