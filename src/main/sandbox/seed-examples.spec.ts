import prelude from 'virtual:sandbox-prelude'
import { describe, expect, it } from 'vitest'
import { makePage } from '../../shared/test-fixtures'
import { EXAMPLE_SOURCES, stripBuildShim } from '../seed'
import { runInSandbox } from './host'

const spaces = [{ id: 'ws', name: 'Workshop' }]
const pages = [
  makePage({
    id: 'o',
    title: 'orders',
    spaceId: 'ws',
    type: 'csv',
    content: EXAMPLE_SOURCES.orders
  }),
  makePage({
    id: 'p',
    title: 'products',
    spaceId: 'ws',
    type: 'csv',
    content: EXAMPLE_SOURCES.products
  })
]

describe('seeded example scripts', () => {
  it('sales starts with its imports and carries no build shim', () => {
    expect(EXAMPLE_SOURCES.sales.startsWith("import orders from 'orders'\n")).toBe(true)
    expect(EXAMPLE_SOURCES.sales).not.toContain('import.meta')
  })

  it.each([
    ['hello', 'typescript'],
    ['today', 'javascript'],
    ['sales', 'javascript']
  ] as const)('%s runs without an error', async (name, language) => {
    const page = makePage({ id: name, title: name, spaceId: 'ws', type: language })
    const result = await runInSandbox(
      {
        language,
        source: EXAMPLE_SOURCES[name],
        context: { page, pages, spaces, folders: [], secrets: {} }
      },
      prelude
    )
    expect(result.error).toBeUndefined()
    expect(result.logs.length).toBeGreaterThan(0)
  })
})

describe('stripBuildShim', () => {
  const shim = [
    '',
    '// -- CommonJS Shims --',
    "import __cjs_mod__ from 'node:module';",
    'const __filename = import.meta.filename;',
    'const __dirname = import.meta.dirname;',
    'const require = __cjs_mod__.createRequire(import.meta.url);',
    ''
  ].join('\n')
  const head = "import orders from 'orders'\nimport products from 'products'\n\n"

  it('restores the seeded sales script', () => {
    const damaged = head + shim + EXAMPLE_SOURCES.sales.slice(head.length)
    expect(stripBuildShim(damaged)).toBe(EXAMPLE_SOURCES.sales)
  })

  it('leaves other text alone', () => {
    expect(stripBuildShim(EXAMPLE_SOURCES.sales)).toBe(EXAMPLE_SOURCES.sales)
    expect(stripBuildShim('// -- CommonJS Shims --\nconsole.log(1)')).toBe(
      '// -- CommonJS Shims --\nconsole.log(1)'
    )
  })
})
