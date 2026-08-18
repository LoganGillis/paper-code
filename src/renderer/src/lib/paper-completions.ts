import {
  autocompletion,
  ifNotIn,
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import {
  completionPath,
  javascriptLanguage,
  scopeCompletionSource
} from '@codemirror/lang-javascript'
import {
  CSV_GLOBALS,
  DATE_GLOBALS,
  DATE_MEMBERS,
  DATE_ROOTS,
  SECRET_GLOBALS,
  TABLE_MEMBERS,
  TABLE_ROOTS,
  type HelperDoc
} from '@shared/helpers/docs'

const DATE_ROOT_SET = new Set<string>(DATE_ROOTS)
const TABLE_ROOT_SET = new Set<string>(TABLE_ROOTS)

const dontCompleteIn = [
  'TemplateString',
  'String',
  'RegExp',
  'LineComment',
  'BlockComment'
] as const

function toCompletion(doc: HelperDoc, boost: number): Completion {
  const type =
    doc.kind === 'constant'
      ? 'constant'
      : doc.kind === 'function'
        ? 'function'
        : doc.kind === 'class'
          ? 'class'
          : doc.kind === 'method'
            ? 'method'
            : 'property'
  const base: Completion = {
    label: doc.label,
    type,
    detail: doc.detail,
    info: doc.info,
    boost
  }
  if (doc.snippet) return snippetCompletion(doc.snippet, base)
  return base
}

const dollarCompletions = [...DATE_GLOBALS, ...CSV_GLOBALS, ...SECRET_GLOBALS].map((doc) =>
  toCompletion(doc, 99)
)
const dateMemberCompletions = DATE_MEMBERS.map((doc) => toCompletion(doc, 80))
const tableMemberCompletions = TABLE_MEMBERS.map((doc) => toCompletion(doc, 80))

const assignedDate = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\$[A-Za-z]+)/g
const assignedCsv = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\$csv\b/g
const importedName = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g

function collectAliases(source: string, roots: Set<string>): Set<string> {
  const aliases = new Set<string>()
  assignedDate.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = assignedDate.exec(source))) {
    if (roots.has(match[2])) aliases.add(match[1])
  }
  return aliases
}

function tableAliases(source: string, csvTitles: Set<string>): Set<string> {
  const aliases = new Set<string>()
  assignedCsv.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = assignedCsv.exec(source))) aliases.add(match[1])
  importedName.lastIndex = 0
  while ((match = importedName.exec(source))) {
    const spec = match[2].replace(/^\.\//, '').replace(/\.csv$/i, '')
    if (csvTitles.has(spec) || csvTitles.has(match[2])) aliases.add(match[1])
  }
  return aliases
}

function csvStringCompletions(
  context: CompletionContext,
  titles: string[]
): CompletionResult | null {
  const from = Math.max(0, context.pos - 80)
  const before = context.state.sliceDoc(from, context.pos)
  const csvCall = /\$csv\(\s*(['"])([^'"]*)$/.exec(before)
  const importFrom = /\bfrom\s+(['"])([^'"]*)$/.exec(before)
  const match = csvCall ?? importFrom
  if (!match) return null
  const quote = match[1]
  const typed = match[2]
  return {
    from: context.pos - typed.length,
    options: titles.map((title) => ({
      label: title,
      type: 'text',
      detail: 'CSV',
      info: csvCall ? 'Load this CSV as a $Table.' : 'Import this page.',
      apply: title + quote
    })),
    validFor: /^[^'"]*$/
  }
}

function looksLikeCsvCall(context: CompletionContext): boolean {
  const from = Math.max(0, context.pos - 60)
  return /\$csv\s*\([^)]*\)\s*\.\s*[\w$]*$/.test(context.state.sliceDoc(from, context.pos))
}

export function createPaperAutocomplete(csvTitles: string[] = []): Extension[] {
  const titleSet = new Set(csvTitles)

  function paperCompletions(context: CompletionContext): CompletionResult | null {
    const path = completionPath(context)
    const source = context.state.doc.toString()

    if (path && path.path.length > 0) {
      const dates = collectAliases(source, DATE_ROOT_SET)
      const tables = tableAliases(source, titleSet)
      const root = path.path[0]
      if (TABLE_ROOT_SET.has(root) || tables.has(root) || looksLikeCsvCall(context)) {
        return {
          from: context.pos - path.name.length,
          options: tableMemberCompletions,
          validFor: /^[\w$]*$/
        }
      }
      if (DATE_ROOT_SET.has(root) || dates.has(root)) {
        return {
          from: context.pos - path.name.length,
          options: dateMemberCompletions,
          validFor: /^[\w$]*$/
        }
      }
      return null
    }

    if (looksLikeCsvCall(context)) {
      return {
        from: context.pos,
        options: tableMemberCompletions,
        validFor: /^[\w$]*$/
      }
    }

    if (!path) return null
    if (!path.name && !context.explicit) return null
    return {
      from: context.pos - path.name.length,
      options: dollarCompletions,
      validFor: /^\$?[\w$]*$/
    }
  }

  return [
    autocompletion({
      activateOnTyping: true,
      icons: true,
      closeOnBlur: true
    }),
    javascriptLanguage.data.of({
      autocomplete: (context: CompletionContext) => csvStringCompletions(context, csvTitles)
    }),
    javascriptLanguage.data.of({
      autocomplete: ifNotIn([...dontCompleteIn], paperCompletions)
    }),
    javascriptLanguage.data.of({
      autocomplete: ifNotIn([...dontCompleteIn], scopeCompletionSource(jsScope))
    })
  ]
}

const jsScope: Record<string, unknown> = {
  console,
  Math,
  Date,
  JSON,
  Promise,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Symbol,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  URIError,
  ReferenceError,
  EvalError,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURI,
  encodeURIComponent,
  decodeURI,
  decodeURIComponent,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  undefined,
  NaN,
  Infinity,
  Intl,
  Proxy,
  Reflect,
  ArrayBuffer,
  DataView,
  Uint8Array,
  Int8Array,
  Uint16Array,
  Int16Array,
  Uint32Array,
  Int32Array,
  Float32Array,
  Float64Array,
  BigInt,
  URL,
  URLSearchParams,
  queueMicrotask
}

export const paperAutocomplete = createPaperAutocomplete()
