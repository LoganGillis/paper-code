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

export type JsonWarningCode =
  'trimmed' | 'unwrapped-string' | 'unsafe-integer' | 'negative-zero' | 'duplicate-key'

export type JsonWarning = { code: JsonWarningCode; message: string }

export type FormattedJson = {
  /** Pretty-printed JSON, ending in a newline. */
  value: string
  /** True when `value` means exactly what the input said, with nothing dropped or changed. */
  exact: boolean
  warnings: JsonWarning[]
}

type ScanFindings = { unsafe: string[]; negativeZero: boolean; duplicates: string[] }

/** Walks valid JSON text and notes values that `JSON.parse` silently changes. */
function scanJson(text: string, findings: ScanFindings): void {
  let index = 0
  const skip = (): void => {
    while (index < text.length && /\s/.test(text[index])) index += 1
  }
  const readString = (): string => {
    const start = index
    index += 1
    while (index < text.length && text[index] !== '"') index += text[index] === '\\' ? 2 : 1
    index += 1
    return JSON.parse(text.slice(start, index)) as string
  }
  const value = (): void => {
    skip()
    const char = text[index]
    if (char === '{') {
      index += 1
      const keys = new Set<string>()
      skip()
      if (text[index] === '}') {
        index += 1
        return
      }
      for (;;) {
        skip()
        const key = readString()
        if (keys.has(key)) findings.duplicates.push(key)
        keys.add(key)
        skip()
        index += 1 // :
        value()
        skip()
        if (text[index++] === '}') return
      }
    }
    if (char === '[') {
      index += 1
      skip()
      if (text[index] === ']') {
        index += 1
        return
      }
      for (;;) {
        value()
        skip()
        if (text[index++] === ']') return
      }
    }
    if (char === '"') {
      readString()
      return
    }
    const match = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index))
    if (match) {
      const literal = match[0]
      index += literal.length
      const number = Number(literal)
      if (Object.is(number, -0)) findings.negativeZero = true
      else if (/^-?\d+$/.test(literal) && !Number.isSafeInteger(number)) {
        findings.unsafe.push(literal)
      }
      return
    }
    index += /^(true|null)/.test(text.slice(index)) ? 4 : 5
  }
  value()
}

type LooseParse = { value: unknown; candidate: string; layers: string[] }

function unwrapString(value: unknown, layers: string[], depth = 0): unknown {
  if (typeof value !== 'string' || depth > 3) return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    const inner = JSON.parse(trimmed)
    layers.push(trimmed)
    return unwrapString(inner, layers, depth + 1)
  } catch {
    return value
  }
}

function parseLoose(raw: string): LooseParse {
  const errors: string[] = []
  for (const candidate of jsonCandidates(raw)) {
    try {
      const layers: string[] = []
      const value = unwrapString(JSON.parse(candidate), layers)
      return { value, candidate, layers }
    } catch (cause) {
      errors.push(cause instanceof Error ? cause.message : String(cause))
    }
  }
  throw new Error(errors[0] || 'Clipboard is not JSON')
}

/** Parses JSON that may be fenced, quoted, escaped, or surrounded by other text. */
export function parseLooseJson(raw: string): unknown {
  return parseLoose(raw).value
}

export function formatJsonValue(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/**
 * Pretty-prints loose JSON and reports anything the result does not keep exactly: text
 * trimmed around the JSON, a JSON string that was unwrapped, integers past 2^53, `-0`, and
 * duplicate keys. Throws when no part of the text is JSON.
 */
export function formatJsonText(raw: string): FormattedJson {
  const { value, candidate, layers } = parseLoose(raw)
  const warnings: JsonWarning[] = []
  const plain = raw.replace(/^\uFEFF/, '').trim()
  if (candidate !== plain && plain.includes(candidate)) {
    warnings.push({ code: 'trimmed', message: 'Text around the JSON was removed.' })
  } else if (candidate !== plain) {
    warnings.push({ code: 'unwrapped-string', message: 'Escaped JSON was unescaped.' })
  }
  if (layers.length > 0 && !warnings.some((warning) => warning.code === 'unwrapped-string')) {
    warnings.push({
      code: 'unwrapped-string',
      message: 'The JSON was inside a string and was unwrapped.'
    })
  }
  const findings: ScanFindings = { unsafe: [], negativeZero: false, duplicates: [] }
  for (const text of [candidate, ...layers]) {
    try {
      scanJson(text, findings)
    } catch {
      // The text already parsed, so a scan failure only means fewer warnings.
    }
  }
  if (findings.unsafe.length > 0) {
    const sample = findings.unsafe.slice(0, 3).join(', ')
    warnings.push({
      code: 'unsafe-integer',
      message: `Large numbers lose precision: ${sample}${findings.unsafe.length > 3 ? '…' : ''}.`
    })
  }
  if (findings.negativeZero) {
    warnings.push({ code: 'negative-zero', message: '-0 becomes 0.' })
  }
  if (findings.duplicates.length > 0) {
    const keys = [...new Set(findings.duplicates)].slice(0, 3).map((key) => `"${key}"`)
    warnings.push({
      code: 'duplicate-key',
      message: `Duplicate keys keep only the last value: ${keys.join(', ')}.`
    })
  }
  return { value: formatJsonValue(value), exact: warnings.length === 0, warnings }
}

class JsonSyntaxError extends Error {
  constructor(
    message: string,
    readonly offset: number
  ) {
    super(message)
  }
}

/** A strict JSON reader that only reports where the first error is. */
function validateJson(text: string): void {
  let index = 0
  const fail = (what: string): never => {
    const found = index < text.length ? `"${text[index]}"` : 'the end'
    throw new JsonSyntaxError(`Expected ${what} but found ${found}`, index)
  }
  const skip = (): void => {
    while (index < text.length && ' \t\n\r'.includes(text[index])) index += 1
  }
  const string = (): void => {
    if (text[index] !== '"') fail('a string')
    index += 1
    while (index < text.length && text[index] !== '"') {
      if (text[index] === '\\') {
        index += 1
        if (text[index] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index + 1, index + 5))) fail('a \\u escape')
          index += 5
          continue
        }
        if (!'"\\/bfnrt'.includes(text[index] ?? 'x')) fail('an escape')
      } else if (text.charCodeAt(index) < 0x20) fail('a closing quote')
      index += 1
    }
    if (text[index] !== '"') fail('a closing quote')
    index += 1
  }
  const value = (): void => {
    skip()
    const char = text[index]
    if (char === '{') {
      index += 1
      skip()
      if (text[index] === '}') {
        index += 1
        return
      }
      for (;;) {
        skip()
        string()
        skip()
        if (text[index] !== ':') fail('":"')
        index += 1
        value()
        skip()
        if (text[index] === ',') {
          index += 1
          continue
        }
        if (text[index] === '}') {
          index += 1
          return
        }
        fail('"," or "}"')
      }
    }
    if (char === '[') {
      index += 1
      skip()
      if (text[index] === ']') {
        index += 1
        return
      }
      for (;;) {
        value()
        skip()
        if (text[index] === ',') {
          index += 1
          continue
        }
        if (text[index] === ']') {
          index += 1
          return
        }
        fail('"," or "]"')
      }
    }
    if (char === '"') return string()
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(index))
    if (number) {
      index += number[0].length
      return
    }
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, index)) {
        index += word.length
        return
      }
    }
    fail('a value')
  }
  value()
  skip()
  if (index < text.length) fail('the end')
}

/** Where strict JSON parsing stops in `text`, as a 0-based offset, or null when it is valid. */
export function jsonErrorAt(text: string): { offset: number; message: string } | null {
  if (!text.trim()) return null
  try {
    validateJson(text)
    return null
  } catch (cause) {
    if (cause instanceof JsonSyntaxError) return { offset: cause.offset, message: cause.message }
    throw cause
  }
}
