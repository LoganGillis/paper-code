import { toast } from 'sonner'
import { clipboardToCsv, looksLikeCsv } from '@shared/csv'
import { formatJsonText, jsonErrorAt } from '@shared/json-text'
import type { JsonPreview } from '@/lib/json-preview'

export const NOT_JSON_MESSAGE = "Clipboard doesn't look like JSON"

export type JsonPaste = { text: string; asText: boolean }

/**
 * Turns clipboard text into what a JSON paste should write: formatted JSON when it reads
 * exactly, the user's pick from the preview when it does not, or null when there is nothing
 * to paste now. Text that looks like a table opens the Paste dialog with "Make a table" (when
 * `onCsv` is given) and "Paste as text"; other non-JSON text shows a toast whose "Paste as text"
 * action calls `onText`, the same thing Ctrl+V does.
 */
export async function resolveJsonPaste(
  raw: string,
  preview: JsonPreview,
  handlers: { onCsv?: (csv: string) => void; onText: (text: string) => void }
): Promise<JsonPaste | null> {
  let result: ReturnType<typeof formatJsonText>
  try {
    result = formatJsonText(raw)
  } catch {
    if (handlers.onCsv && looksLikeCsv(raw)) {
      const choice = await preview({
        result: { value: raw.trim(), exact: false, warnings: [] },
        title: 'Paste this table?',
        description:
          "This isn't JSON, but it looks like a table. The first row becomes the header.",
        textLabel: 'Paste as text',
        tableLabel: 'Make a table'
      })
      if (choice === 'table') handlers.onCsv(clipboardToCsv(raw))
      if (choice === 'text') return { text: raw, asText: true }
      return null
    }
    if (!raw.trim()) {
      toast.error('The clipboard is empty')
      return null
    }
    toast.error(NOT_JSON_MESSAGE, {
      action: { label: 'Paste as text', onClick: () => handlers.onText(raw) }
    })
    return null
  }
  if (result.exact) return { text: result.value, asText: false }
  const choice = await preview({
    result,
    title: 'Paste this JSON?',
    jsonLabel: 'Paste as JSON',
    textLabel: 'Paste as text'
  })
  if (choice === 'json') return { text: result.value, asText: false }
  if (choice === 'text') return { text: raw, asText: true }
  return null
}

/**
 * Formats JSON text. On a syntax error it shows a toast and calls `onError` with the offset
 * so the editor can jump there. Asks first when formatting would change the meaning.
 * Returns the new text, or null when nothing should change.
 */
export async function resolveJsonFormat(
  source: string,
  preview: JsonPreview,
  onError?: (offset: number) => void
): Promise<string | null> {
  let result: ReturnType<typeof formatJsonText>
  try {
    result = formatJsonText(source)
  } catch {
    const at = jsonErrorAt(source)
    toast.error(at ? `Not valid JSON: ${at.message}` : 'Not valid JSON')
    if (at) onError?.(at.offset)
    return null
  }
  if (result.value === source) return null
  if (result.exact) return result.value
  const choice = await preview({
    result,
    title: 'Format this JSON?',
    jsonLabel: 'Format',
    textLabel: 'Keep as is'
  })
  return choice === 'json' ? result.value : null
}

/**
 * The content for a page opened from a JSON file. Exact JSON is formatted; JSON that formatting
 * would change (big numbers, duplicate keys, surrounding text) asks first, and keeps the file's
 * original text unless the user picks the formatted version. Invalid JSON is kept as it is so
 * the editor can mark the error. Returns null when the user cancels.
 */
export async function jsonFileContent(raw: string, preview: JsonPreview): Promise<string | null> {
  let result: ReturnType<typeof formatJsonText>
  try {
    result = formatJsonText(raw)
  } catch {
    return raw
  }
  if (result.exact) return result.value
  const choice = await preview({
    result,
    title: 'Open this JSON?',
    description: 'Formatting would change this file. Keep the original text to open it as it is.',
    jsonLabel: 'Use formatted JSON',
    textLabel: 'Keep original text'
  })
  if (choice === 'json') return result.value
  if (choice === 'text') return raw
  return null
}
