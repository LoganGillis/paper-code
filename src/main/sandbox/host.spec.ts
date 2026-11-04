import prelude from 'virtual:sandbox-prelude'
import { describe, expect, it } from 'vitest'
import { makePage } from '../../shared/test-fixtures'
import type { Page } from '../../shared/api'
import { runInSandbox } from './host'

const spaces = [{ id: 'ws', name: 'Workshop' }]
const folders = [{ id: 'reports', name: 'Reports', parentId: null, spaceId: 'ws' }]
const script = makePage({ id: 'script', title: 'script', spaceId: 'ws', type: 'javascript' })
const pages: Page[] = [
  makePage({ id: 'j1', title: 'Data', spaceId: 'ws', type: 'json', content: '{"at":"root"}' }),
  makePage({
    id: 'j2',
    title: 'Data',
    spaceId: 'ws',
    type: 'json',
    folderId: 'reports',
    content: '{"at":"reports"}'
  }),
  makePage({ id: 'c1', title: 'Data', spaceId: 'ws', type: 'csv', content: 'n\n1\n2\n' }),
  makePage({
    id: 'm1',
    title: 'math',
    spaceId: 'ws',
    type: 'typescript',
    content:
      'export const twice = (n: number): number => n * 2\nexport const rows = $csv("Workshop//Data").length'
  }),
  makePage({ id: 'b1', title: 'broken', spaceId: 'ws', type: 'javascript', content: 'let = =' })
]

function run(source: string, timeout?: number): ReturnType<typeof runInSandbox> {
  return runInSandbox(
    {
      language: 'javascript',
      source,
      context: { page: script, pages, spaces, folders, secrets: { API_KEY: 'sk-live-12345' } }
    },
    prelude,
    timeout
  )
}

describe('sandbox page resolution', () => {
  it('$csv ignores same-titled JSON pages', async () => {
    expect((await run('$csv("Data").length')).result).toBe('2')
  })

  it('$json prefers the one same-folder match; require still reports a mixed-type tie', async () => {
    expect((await run('$json("Data").at')).result).toBe('root')
    expect((await run('require("Data")')).error).toBe(
      '"Data" matches 3 importable pages. Use the full path: "Workshop//Data.json", "Workshop/Reports/Data.json", "Workshop//Data.csv"'
    )
  })

  it('require picks a page by extension when a CSV and a JSON page share a title', async () => {
    expect((await run('require("Data.json").at')).result).toBe('root')
    expect((await run('require("Workshop//Data.csv").length')).result).toBe('2')
    expect((await run('require("Workshop/Reports/Data.json").at')).result).toBe('reports')
  })

  it('$json uses the strict parser and names the page', async () => {
    const extra = [
      makePage({ id: 'bad', title: 'Loose', spaceId: 'ws', type: 'json', content: '{a: 1}' }),
      makePage({ id: 'empty', title: 'Blank', spaceId: 'ws', type: 'json', content: '  ' })
    ]
    const go = (source: string): ReturnType<typeof runInSandbox> =>
      runInSandbox(
        {
          language: 'javascript',
          source,
          context: { page: script, pages: [...pages, ...extra], spaces, folders }
        },
        prelude
      )
    const loose = (await go('$json("Loose")')).error ?? ''
    expect(loose).toMatch(/^"Loose" is not valid JSON: Expected .+ \(line 1, column 2\)$/)
    expect((await go('require("Blank")')).error).toBe('"Blank" is empty')
    expect(loose + (await go('$json("Blank")')).error).not.toMatch(/Clipboard/)
  })

  it('$json, $csv, and require accept Space/Folder/Title', async () => {
    expect((await run('$json("Workshop/Reports/Data").at')).result).toBe('reports')
    expect((await run('$json("Workshop//Data").at')).result).toBe('root')
    expect((await run('require("Workshop/Reports/Data").at')).result).toBe('reports')
    expect((await run('$csv("Workshop//Data").length')).result).toBe('2')
  })

  it('imports TypeScript modules', async () => {
    const out = await run('import { twice, rows } from "math"\nconsole.log(twice(rows))')
    expect(out.error).toBeUndefined()
    expect(out.logs[0].message).toBe('4')
  })
})

describe('sandbox output', () => {
  it('formats logs, tables, objects, and async results', async () => {
    const out = await run(
      'console.log({ a: 1, list: [1, "two"], f() { return 1 } });\nconsole.log($csv("Workshop//Data"));\n({ done: true, when: new Date(0) })'
    )
    expect(out.logs[0]).toMatchObject({
      message: "{ a: 1, list: [ 1, 'two' ], f: [Function: f] }",
      kind: 'object',
      object: { a: 1, list: [1, 'two'], f: '[Function]' }
    })
    expect(out.logs[1]).toMatchObject({ kind: 'table', table: [['n'], ['1'], ['2']] })
    expect(out.resultObject).toEqual({ done: true, when: '1970-01-01T00:00:00.000Z' })
  })

  it('waits for promises and timers', async () => {
    const out = await run(
      'new Promise((resolve) => setTimeout(() => { console.log("tick"); resolve(7) }, 10))'
    )
    expect(out.logs.map((log) => log.message)).toEqual(['tick'])
    expect(out.result).toBe('7')
  })

  it('masks secret values in logs, results, and errors', async () => {
    const out = await run(
      'console.log("key", $secret("API_KEY")); console.log({ k: $secrets.API_KEY }); throw new Error("bad " + $secret("API_KEY"))'
    )
    expect(JSON.stringify(out)).not.toContain('sk-live-12345')
    expect(out.logs[0].message).toBe('key $secret(API_KEY)')
    expect(out.error).toBe('bad $secret(API_KEY)')
  })

  it('returns $secrets as its names, and await does not probe it for a secret', async () => {
    expect((await run('$secrets')).resultObject).toEqual(['API_KEY'])
    const awaited = await run('(async () => $secrets)()')
    expect(awaited.error).toBeUndefined()
    expect(awaited.resultObject).toEqual(['API_KEY'])
    expect((await run('JSON.stringify($secrets)')).result).toBe('["API_KEY"]')
    expect((await run('String($secrets)')).result).toBe('$secrets { API_KEY }')
    expect(JSON.stringify(await run('$secrets'))).not.toContain('sk-live-12345')
  })

  it('times out sync loops and stuck async work', async () => {
    expect((await run('while (true) {}', 200)).error).toBe('Timed out after 200ms')
    expect((await run('new Promise(() => {})', 200)).error).toBe('Timed out after 200ms')
    expect((await run('setInterval(() => { while (true) {} }, 1); 1', 300)).result).toBe('1')
  })
})

describe('sandbox isolation', () => {
  const escapes = [
    'console.log.constructor.constructor("return process")()',
    '$csv.constructor.constructor("return process")()',
    '$Table.constructor.constructor("return process")()',
    'setTimeout.constructor.constructor("return process")()',
    'this.constructor.constructor("return process")()',
    '$secrets.constructor',
    '$date.constructor.constructor("return process")()',
    'require.constructor.constructor("return typeof process")()',
    'globalThis.constructor.constructor("return process")()',
    '(() => { try { $json("nope") } catch (e) { return e.constructor.constructor("return process")() } })()',
    '(() => { try { require("nope") } catch (e) { return e.constructor.constructor("return process")() } })()'
  ]

  for (const source of escapes) {
    it(`cannot reach the host from ${source.slice(0, 50)}`, async () => {
      const out = await run(source)
      expect(out.result ?? '').not.toMatch(/process \{|pid|versions/)
      if (out.error) expect(out.error).toMatch(/process is not defined|No secret named/)
    })
  }

  it('blocks the console.log constructor escape', async () => {
    const out = await run('console.log.constructor.constructor("return process")()')
    expect(out.error).toBe('process is not defined')
  })

  it('wraps host-side errors in sandbox errors', async () => {
    const out = await run(
      '(() => { try { require("broken") } catch (e) { return [e instanceof Error, e.message.length > 0].join() } })()'
    )
    expect(out.result).toBe('true,true')
  })

  it('has no Node globals', async () => {
    const out = await run(
      '[typeof process, typeof $csv("Workshop//Data"), typeof Buffer, typeof globalThis.global, typeof __paperBridge].join(",")'
    )
    expect(out.result).toBe('undefined,object,undefined,undefined,undefined')
  })

  it('does not hand host functions to a thenable result', async () => {
    const out = await run(
      '({ then(resolve) { resolve(typeof resolve.constructor("return process")()) } })'
    )
    expect(out.error).toMatch(/process is not defined/)
  })

  it('locks Error.prepareStackTrace', async () => {
    const out = await run('Error.prepareStackTrace = () => 1')
    expect(out.error).toMatch(/read only/)
    expect((await run('String(Error.prepareStackTrace)')).result).toBe('undefined')
  })
})
