import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatJsonText, parseLooseJson } from './json-text'

test('parseLooseJson reads plain JSON', () => {
  assert.deepEqual(parseLooseJson('{"a":1}'), { a: 1 })
})

test('parseLooseJson unwraps escaped quotes and a surrounding string', () => {
  assert.deepEqual(parseLooseJson('"{\\"name\\":\\"Ada\\"}"'), { name: 'Ada' })
  assert.deepEqual(parseLooseJson('{\\"n\\":1}'), { n: 1 })
})

test('formatJsonText pretty-prints a fenced blob', () => {
  assert.equal(formatJsonText('```json\n{"b":2,"a":1}\n```'), '{\n  "b": 2,\n  "a": 1\n}\n')
})
