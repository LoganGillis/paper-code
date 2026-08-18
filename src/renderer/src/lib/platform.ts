export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
}

export function modSymbol(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

export function wantsNewTab(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}
