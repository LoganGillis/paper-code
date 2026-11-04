import { describe, expect, it } from 'vitest'
import { installSecretHelpers } from '../shared/helpers/secret-bag'
import { $Table } from '../shared/helpers/table'
import { cloneableResult, toCloneable } from './run-serialize'

describe('toCloneable', () => {
  it('replaces functions and keeps plain data', () => {
    const value = { a: 1, fn: () => 1, nested: [1, 'two', { f: () => 0 }], when: new Date(0) }
    const out = toCloneable(value) as Record<string, unknown>
    expect(out).toEqual({
      a: 1,
      fn: '[Function]',
      nested: [1, 'two', { f: '[Function]' }],
      when: new Date(0)
    })
    expect(() => structuredClone(out)).not.toThrow()
  })

  it('never walks the $secrets proxy', () => {
    const scope: Record<string, unknown> = {}
    installSecretHelpers(scope, { API_KEY: 'sk-live-123' })
    const out = toCloneable({ bag: scope.$secrets })
    expect(out).toEqual({ bag: '[$secrets]' })
    expect(JSON.stringify(out)).not.toContain('sk-live-123')
  })

  it('handles cycles, tables, and getters that throw', () => {
    const loop: Record<string, unknown> = { name: 'loop' }
    loop.self = loop
    const table = $Table.fromCsv('a,b\n1,2\n')
    const bad = Object.defineProperty({}, 'boom', {
      enumerable: true,
      get() {
        throw new Error('no')
      }
    })
    const out = toCloneable({ loop, table, bad }) as Record<string, unknown>
    expect((out.loop as Record<string, unknown>).self).toBe('[Circular]')
    expect(out.table).toEqual([{ a: 1, b: 2 }])
    expect(out.bad).toEqual({ boom: '[Unreadable]' })
    expect(() => structuredClone(out)).not.toThrow()
  })
})

describe('cloneableResult', () => {
  it('cleans log objects and the result object', () => {
    const result = cloneableResult({
      logs: [{ level: 'log', message: 'x', kind: 'object', object: { f: () => 0 } }],
      resultKind: 'object',
      resultObject: { g: Symbol('s') }
    })
    expect(result.logs[0].object).toEqual({ f: '[Function]' })
    expect(result.resultObject).toEqual({ g: 'Symbol(s)' })
    expect(() => structuredClone(result)).not.toThrow()
  })
})
