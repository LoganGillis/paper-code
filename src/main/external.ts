import { shell } from 'electron'

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** True for URLs Paper may hand to the OS: `http:`, `https:`, and `mailto:` only. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

/** Opens a link in the default app when its protocol is allowed; ignores everything else. */
export function openExternalSafely(url: string): void {
  if (!isSafeExternalUrl(url)) {
    console.warn('Blocked external link', url.slice(0, 200))
    return
  }
  void shell.openExternal(url)
}
