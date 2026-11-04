const drafts = new Map<string, string>()

/** Remember the editor buffer of a script page that may not be saved yet. */
export function setRunDraft(pageId: string, source: string): void {
  drafts.set(pageId, source)
}

/** Forget a page's buffer once `saved` has reached the database (or the page closed). */
export function clearRunDraft(pageId: string, saved?: string): void {
  if (saved === undefined || drafts.get(pageId) === saved) drafts.delete(pageId)
}

/** The source to run for a page: its unsaved buffer when one is open, else the saved content. */
export function runSourceFor(pageId: string, saved: string): string {
  return drafts.get(pageId) ?? saved
}
