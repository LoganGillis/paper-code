export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
}

export function modSymbol(): string {
  return isMac() ? '⌘' : 'Ctrl'
}
