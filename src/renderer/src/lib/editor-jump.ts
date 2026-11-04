import type { EditorView } from '@codemirror/view'

/** Moves the cursor to `offset`, scrolls it into view, and focuses the editor. */
export function jumpTo(view: EditorView | null, offset: number): void {
  if (!view) return
  const anchor = Math.max(0, Math.min(offset, view.state.doc.length))
  view.dispatch({ selection: { anchor }, scrollIntoView: true })
  view.focus()
}
