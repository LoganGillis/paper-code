const targets = new WeakMap<object, { pageId: string; spaceId: string }>()

export function setRunContext(editor: object, pageId: string, spaceId: string): void {
  targets.set(editor, { pageId, spaceId })
}

export function getRunContext(editor: object): { pageId: string; spaceId: string } {
  return targets.get(editor) ?? { pageId: '', spaceId: '' }
}
