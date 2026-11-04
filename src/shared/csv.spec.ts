import { describe, expect, it } from 'vitest'
import { looksLikeCsv, parseClipboardGrid } from './csv'

describe('parseClipboardGrid', () => {
  it('splits comma-separated text', () => {
    expect(parseClipboardGrid('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('splits tab-separated text and keeps commas inside cells', () => {
    expect(parseClipboardGrid('name\tnote\r\nAda\tHi, there\r\n')).toEqual([
      ['name', 'note'],
      ['Ada', 'Hi, there']
    ])
  })

  it('keeps quoted delimiters and newlines', () => {
    expect(parseClipboardGrid('"a,b","line\nbreak",c')).toEqual([['a,b', 'line\nbreak', 'c']])
  })

  it('reads a single value as one cell', () => {
    expect(parseClipboardGrid('hello')).toEqual([['hello']])
  })
})

describe('looksLikeCsv', () => {
  it('accepts consistent rows', () => {
    expect(looksLikeCsv('sku,qty\nTEA,3\nMUG,2')).toBe(true)
    expect(looksLikeCsv('sku\tqty\nTEA\t3')).toBe(true)
  })

  it('rejects prose, JSON, and ragged rows', () => {
    expect(looksLikeCsv('Hello, world')).toBe(false)
    expect(looksLikeCsv('{"a":1,\n"b":2}')).toBe(false)
    expect(looksLikeCsv('a,b\n1,2,3')).toBe(false)
    expect(looksLikeCsv('one\ntwo')).toBe(false)
  })
})
