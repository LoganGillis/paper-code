import type { RunResult } from './api'

/**
 * Secrets shorter than this are left alone so they don't mask ordinary text. Redaction matches the
 * exact value only: a transformed secret (base64, reversed, sliced, hashed) cannot be redacted.
 */
export const MIN_REDACT_LENGTH = 3

type Mask = { value: string; label: string }

function masks(secrets: Record<string, string>): Mask[] {
  return Object.entries(secrets)
    .filter(([, value]) => typeof value === 'string' && value.length >= MIN_REDACT_LENGTH)
    .map(([name, value]) => ({ value, label: `$secret(${name})` }))
    .sort((a, b) => b.value.length - a.value.length)
}

function maskText(text: string, list: Mask[]): string {
  let out = text
  for (const mask of list) {
    if (out.includes(mask.value)) out = out.split(mask.value).join(mask.label)
  }
  return out
}

function walk(value: unknown, list: Mask[], seen: WeakMap<object, unknown>): unknown {
  if (typeof value === 'string') return maskText(value, list)
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const out: unknown[] = []
    seen.set(value, out)
    for (const item of value) out.push(walk(item, list, seen))
    return out
  }
  const out: Record<string, unknown> = {}
  seen.set(value, out)
  for (const [key, item] of Object.entries(value)) {
    out[maskText(key, list)] = walk(item, list, seen)
  }
  return out
}

/**
 * Replaces every secret value found in strings (and object keys) with `$secret(NAME)`.
 * Values shorter than {@link MIN_REDACT_LENGTH} are skipped.
 */
export function redactSecrets<T>(value: T, secrets: Record<string, string>): T {
  const list = masks(secrets)
  if (list.length === 0) return value
  return walk(value, list, new WeakMap()) as T
}

/** Masks secret values in a run's logs, result, and error before it is stored or shown. */
export function redactRunResult(result: RunResult, secrets: Record<string, string>): RunResult {
  return redactSecrets(result, secrets)
}
