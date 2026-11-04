import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { JsonPreview, JsonPreviewChoice } from '@/lib/json-preview'
import { jsonFileContent } from './json-actions'

function previewReturning(choice: JsonPreviewChoice): Mock<JsonPreview> {
  return vi.fn<JsonPreview>(async () => choice)
}

describe('jsonFileContent', () => {
  it('formats exact JSON without asking', async () => {
    const preview = previewReturning('json')
    expect(await jsonFileContent('{"a":1}', preview)).toBe('{\n  "a": 1\n}\n')
    expect(preview).not.toHaveBeenCalled()
  })

  it('keeps invalid JSON as it is', async () => {
    const preview = previewReturning('json')
    expect(await jsonFileContent('{oops', preview)).toBe('{oops')
    expect(preview).not.toHaveBeenCalled()
  })

  const inexact = [
    ['a big integer', '{"id": 12345678901234567890}'],
    ['a duplicate key', '{"a": 1, "a": 2}'],
    ['surrounding text', 'result: {"a": 1} done']
  ]

  for (const [label, raw] of inexact) {
    it(`asks before rewriting ${label}, and keeps the original on "text"`, async () => {
      const preview = previewReturning('text')
      expect(await jsonFileContent(raw, preview)).toBe(raw)
      expect(preview).toHaveBeenCalledTimes(1)
      expect(preview.mock.calls[0][0].result.exact).toBe(false)
    })
  }

  it('uses the formatted JSON when picked, and nothing on cancel', async () => {
    const raw = '{"a": 1, "a": 2}'
    expect(await jsonFileContent(raw, previewReturning('json'))).not.toBe(raw)
    expect(await jsonFileContent(raw, previewReturning(null))).toBeNull()
  })
})
