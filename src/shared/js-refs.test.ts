import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renameAt } from './js-refs'

test('renameAt renames a function and its calls, not a shadowed name', () => {
  const source = 'function greet() { greet() }\nfunction other(greet) { return greet }'
  const renamed = renameAt(source, source.indexOf('greet'), 'hello')
  assert.equal(renamed, 'function hello() { hello() }\nfunction other(greet) { return greet }')
})

test('renameAt skips property names', () => {
  const source = 'const row = { name: 1 }\nrow.name'
  assert.equal(renameAt(source, source.indexOf('name'), 'title'), null)
})

test('renameAt renames a const and its references only', () => {
  const source = 'const value = 1\nconsole.log(value)\nfunction keep(value) { return value }'
  const renamed = renameAt(source, source.indexOf('value'), 'count')
  assert.equal(
    renamed,
    'const count = 1\nconsole.log(count)\nfunction keep(value) { return value }'
  )
})
