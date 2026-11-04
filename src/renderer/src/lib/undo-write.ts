/** What Undo needs to put a page back to the text it had before a Format or Paste. */
export type UndoWrite = {
  /** The editor's text right now. */
  current: () => string
  /** The text the Format or Paste wrote. */
  applied: string
  /** The text before it. */
  previous: string
  /** Drops the pending save of `applied`. */
  cancelPending: () => void
  /** Shows `text` in the editor. */
  apply: (text: string) => void
  save: (text: string) => Promise<void>
}

/**
 * Reverts a Format or Paste, but only while the editor still shows exactly what it wrote: once
 * the user has typed since, Undo would throw their edits away, so it does nothing and returns
 * false. Otherwise it cancels the pending save, restores `previous`, saves it, and returns true.
 */
export async function undoWrite(undo: UndoWrite): Promise<boolean> {
  if (undo.current() !== undo.applied) return false
  undo.cancelPending()
  undo.apply(undo.previous)
  await undo.save(undo.previous)
  return true
}
