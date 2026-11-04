import { toast } from 'sonner'
import { looksLikeCsv } from '@shared/csv'
import { formatJsonText, jsonErrorAt } from '@shared/json-text'
import type { JsonPreview } from '@/lib/json-preview'

export const NOT_JSON_MESSAGE = "Clipboard doesn't look like JSON"

/**
 * Turns clipboard text into what a JSON paste should write: formatted JSON when it reads
 * exactly, the user's pick from the preview when it does not, or null when there is nothing
 * to paste. Text that looks like CSV gets a "Make a table" button when `onCsv` is given.
 */
export async function resolveJsonPaste(
  raw: string,
  preview: JsonPreview,
  onCsv?: (text: string) => void
): Promise<string | null> {
  let result: ReturnType<typeof formatJsonText>
  try {
    result = formatJsonText(raw)
  } catch {
    if (onCsv && looksLikeCsv(raw)) {
      toast(NOT_JSON_MESSAGE, {
        description: 'It looks like a table.',
        action: { label: 'Make a table', onClick: () => onCsv(raw) }
      })
    } else {
      toast.error(NOT_JSON_MESSAGE)
    }
    return null
  }
  if (result.exact) return result.value
  const choice = await preview({
    result,
    title: 'Paste this JSON?',
    jsonLabel: 'Paste as JSON',
    textLabel: 'Paste as text'
  })
  if (choice === 'json') return result.value
  if (choice === 'text') return raw
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
