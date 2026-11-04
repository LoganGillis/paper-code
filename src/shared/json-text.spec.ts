import { describe, expect, it } from 'vitest'
import { formatJsonText, jsonErrorAt } from './json-text'

const codes = (raw: string): string[] => formatJsonText(raw).warnings.map((warning) => warning.code)

describe('formatJsonText', () => {
  it('is exact for plain JSON, including surrounding whitespace', () => {
    expect(formatJsonText('  {"a":[1,2,{"b":null}]}\n')).toEqual({
      value: '{\n  "a": [\n    1,\n    2,\n    {\n      "b": null\n    }\n  ]\n}\n',
      exact: true,
      warnings: []
    })
  })

  it('warns when text around the JSON is trimmed', () => {
    expect(codes('response: {"ok":true} (200)')).toEqual(['trimmed'])
    expect(formatJsonText('```json\n{"ok":true}\n```').exact).toBe(false)
  })

  it('warns when a JSON string is unwrapped or unescaped', () => {
    expect(codes('"{\\"a\\":1}"')).toEqual(['unwrapped-string'])
    expect(codes('{\\"a\\":1}')).toEqual(['unwrapped-string'])
  })

  it('warns about integers past 2^53', () => {
    const result = formatJsonText('{"id":12345678901234567890,"ok":9007199254740991}')
    expect(result.warnings).toEqual([
      { code: 'unsafe-integer', message: 'Large numbers lose precision: 12345678901234567890.' }
    ])
  })

  it('warns about -0', () => {
    expect(codes('[-0, 0, -0.0, -0e5, -1]')).toEqual(['negative-zero'])
    expect(codes('[0, -1, 0.5]')).toEqual([])
  })

  it('warns about duplicate keys, at any depth', () => {
    const result = formatJsonText('{"a":1,"b":{"c":1,"c":2},"a":3}')
    expect(result.value).toBe('{\n  "a": 3,\n  "b": {\n    "c": 2\n  }\n}\n')
    expect(result.warnings).toEqual([
      { code: 'duplicate-key', message: 'Duplicate keys keep only the last value: "c", "a".' }
    ])
  })

  it('does not mistake keys in different objects or strings for duplicates', () => {
    expect(codes('[{"a":1},{"a":2},"{\\"a\\":1,\\"a\\":2}x"]')).toEqual([])
  })

  it('scans JSON that was unwrapped from a string', () => {
    expect(codes('"{\\"a\\":1,\\"a\\":2}"')).toEqual(['unwrapped-string', 'duplicate-key'])
  })

  it('throws when nothing is JSON', () => {
    expect(() => formatJsonText('name,qty\ntea,3')).toThrow()
  })
})

describe('jsonErrorAt', () => {
  it('returns null for valid or empty text', () => {
    expect(jsonErrorAt('{"a":1}')).toBeNull()
    expect(jsonErrorAt('  ')).toBeNull()
  })

  it('finds where parsing stopped', () => {
    const text = '{\n  "a": 1,\n  "b": ]\n}'
    expect(jsonErrorAt(text)?.offset).toBe(text.indexOf(']'))
    expect(jsonErrorAt('{"a":')?.offset).toBe(5)
  })
})

describe('jsonErrorAt agrees with JSON.parse', () => {
  it.each([
    '{"a":1,}',
    '[1 2]',
    '{"a" 1}',
    '"tab\there"',
    '01',
    '[1]x',
    '{"a":"\\q"}',
    'nul',
    '[1,2]'
  ])('%s', (text) => {
    let valid = true
    try {
      JSON.parse(text)
    } catch {
      valid = false
    }
    expect(jsonErrorAt(text) === null).toBe(valid)
  })
})
