import { describe, expect, it } from 'vitest'
import { redactRunResult, redactSecrets } from './redact'

describe('redactSecrets', () => {
  const secrets = {
    API_KEY: 'sk-live-12345',
    SHORT: 'ab',
    PIN: 'abc',
    TOKEN: 'sk-live-12345-extra'
  }

  it('masks values in nested strings and keys, longest first', () => {
    const out = redactSecrets(
      {
        text: 'a sk-live-12345-extra b sk-live-12345',
        list: ['sk-live-12345'],
        'sk-live-12345': 1
      },
      secrets
    )
    expect(out).toEqual({
      text: 'a $secret(TOKEN) b $secret(API_KEY)',
      list: ['$secret(API_KEY)'],
      '$secret(API_KEY)': 1
    })
  })

  it('masks three-character values but leaves shorter ones alone', () => {
    expect(redactSecrets('abc ab', secrets)).toBe('$secret(PIN) ab')
  })

  it('masks a whole run result', () => {
    const out = redactRunResult(
      {
        logs: [
          { level: 'log', message: 'sk-live-12345', kind: 'table', table: [['sk-live-12345']] }
        ],
        result: 'sk-live-12345',
        error: 'bad sk-live-12345'
      },
      secrets
    )
    expect(JSON.stringify(out)).not.toContain('sk-live-12345')
  })
})
