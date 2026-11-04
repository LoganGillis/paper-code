import { describe, expect, it } from 'vitest'
import { RPC_PATHS } from '../shared/rpc-paths'
import { lookupProcedure } from './rpc-dispatch'

const get = async (): Promise<string> => 'page'
const table = { pages: { get }, spaces: { list: async () => [] } }

describe('lookupProcedure', () => {
  it('finds allowlisted own handlers', () => {
    expect(lookupProcedure(table, 'pages.get')).toBe(get)
  })

  it('rejects unknown and prototype paths', () => {
    for (const path of [
      'pages.constructor',
      'pages.__proto__',
      '__proto__.toString',
      'constructor.name',
      'pages.toString',
      'pages.get.call',
      'pages',
      42,
      undefined
    ]) {
      expect(lookupProcedure(table, path)).toBeNull()
    }
  })

  it('rejects allowlisted paths that are only inherited', () => {
    const inherited = Object.create({ list: async () => [] }) as object
    expect(lookupProcedure({ spaces: inherited }, 'spaces.list')).toBeNull()
  })

  it('lists each path once', () => {
    expect(new Set(RPC_PATHS).size).toBe(RPC_PATHS.length)
  })
})
