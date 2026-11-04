import { describe, expect, it } from 'vitest'
import { extensionForType, isPageType, PAGE_TYPE_IDS, PAGE_TYPES } from './page-types'

describe('page types', () => {
  it('derives the id list from the registry', () => {
    expect(PAGE_TYPE_IDS).toEqual(Object.keys(PAGE_TYPES))
  })

  it('rejects unknown and prototype keys', () => {
    expect(isPageType('json')).toBe(true)
    expect(isPageType('toString')).toBe(false)
    expect(isPageType('__proto__')).toBe(false)
    expect(isPageType(3)).toBe(false)
  })

  it('falls back to .md for unknown types', () => {
    expect(extensionForType('csv')).toBe('.csv')
    expect(extensionForType('canvas')).toBe('.md')
    expect(extensionForType('constructor')).toBe('.md')
  })
})
