import { createContext, useContext } from 'react'
import type { FormattedJson } from '@shared/json-text'

export type JsonPreviewRequest = {
  result: FormattedJson
  title: string
  jsonLabel: string
  textLabel: string
}

/** `json` keeps the formatted JSON, `text` keeps the original text, `null` cancels. */
export type JsonPreviewChoice = 'json' | 'text' | null

export type JsonPreview = (request: JsonPreviewRequest) => Promise<JsonPreviewChoice>

export const JsonPreviewContext = createContext<JsonPreview | null>(null)

/** Opens the JSON preview dialog and resolves with the choice. */
export function useJsonPreview(): JsonPreview {
  const preview = useContext(JsonPreviewContext)
  if (!preview) throw new Error('useJsonPreview must be used inside JsonPreviewProvider')
  return preview
}
