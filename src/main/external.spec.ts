import { beforeEach, describe, expect, it, vi } from 'vitest'

const openExternal = vi.fn(async () => undefined)
vi.mock('electron', () => ({ shell: { openExternal } }))

const { isSafeExternalUrl, openExternalSafely } = await import('./external')

describe('external links', () => {
  beforeEach(() => openExternal.mockClear())

  it('allows only http, https, and mailto', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
    expect(isSafeExternalUrl('mailto:a@b.c')).toBe(true)
    for (const url of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'smb://host/share',
      'vscode://x',
      'data:text/html,hi',
      'not a url'
    ]) {
      expect(isSafeExternalUrl(url)).toBe(false)
    }
  })

  it('never hands a blocked URL to the OS', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    openExternalSafely('file:///Applications/Calculator.app')
    expect(openExternal).not.toHaveBeenCalled()
    openExternalSafely('https://paper.example')
    expect(openExternal).toHaveBeenCalledWith('https://paper.example')
  })
})
