import { createContext, useContext } from 'react'
import type { FormattedJson } from '@shared/json-text'

export type JsonPreviewRequest = {
  result: FormattedJson
  title: string
  /** Shown above the warnings, e.g. why a table is offered. */
  description?: string
  /** Omit to hide the JSON button (the text is not JSON). */
  jsonLabel?: string
  textLabel: string
  /** When set, the main button offers to make a CSV table instead. */
  tableLabel?: string
}

/**
 * `json` keeps the formatted JSON, `text` keeps the original text, `table` makes a CSV table,
 * `null` cancels.
 */
export type JsonPreviewChoice = 'json' | 'text' | 'table' | null

export type JsonPreview = (request: JsonPreviewRequest) => Promise<JsonPreviewChoice>

export const JsonPreviewContext = createContext<JsonPreview | null>(null)

/** Opens the JSON preview dialog and resolves with the choice. */
export function useJsonPreview(): JsonPreview {
  const preview = useContext(JsonPreviewContext)
  if (!preview) throw new Error('useJsonPreview must be used inside JsonPreviewProvider')
  return preview
}
