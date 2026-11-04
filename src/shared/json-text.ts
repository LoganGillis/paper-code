function stripFence(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function sliceValue(text: string): string | null {
  const start = text.search(/[[{]/)
  if (start < 0) return null
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (end <= start) return null
  return text.slice(start, end + 1)
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

/** Candidates for JSON that was copied out of a string, a log, or a fence. */
export function jsonCandidates(raw: string): string[] {
  const text = stripFence(raw)
  const unquoted =
    (text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))
      ? text.slice(1, -1)
      : text
  const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\')
  const sliced = sliceValue(text)
  const slicedUnescaped = sliceValue(unescaped)
  return unique([text, unquoted, unescaped, sliced ?? '', slicedUnescaped ?? ''])
}

function unwrapString(value: unknown, depth = 0): unknown {
  if (typeof value !== 'string' || depth > 3) return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    return unwrapString(JSON.parse(trimmed), depth + 1)
  } catch {
    return value
  }
}

export function parseLooseJson(raw: string): unknown {
  const errors: string[] = []
  for (const candidate of jsonCandidates(raw)) {
    try {
      return unwrapString(JSON.parse(candidate))
    } catch (cause) {
      errors.push(cause instanceof Error ? cause.message : String(cause))
    }
  }
  throw new Error(errors[0] || 'Clipboard is not JSON')
}

export function formatJsonValue(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function formatJsonText(raw: string): string {
  return formatJsonValue(parseLooseJson(raw))
}
