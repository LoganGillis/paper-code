export type Span = { from: number; to: number }

type Tok =
  | { t: 'id'; from: number; to: number; value: string }
  | { t: 'str'; from: number; to: number; value: string }
  | { t: 'punct'; from: number; to: number; value: string }

type Binding = { name: string; spans: Span[] }
type Scope = { parent: Scope | null; names: Map<string, Binding> }

const CONTROL = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'try',
  'catch',
  'finally',
  'switch',
  'with'
])

function lex(source: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (c === '\n') {
      out.push({ t: 'punct', from: i, to: i + 1, value: '\n' })
      i += 1
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i += 1
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1
      i = Math.min(source.length, i + 2)
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      const start = i
      i += 1
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2
          continue
        }
        if (source[i] === quote) {
          i += 1
          break
        }
        i += 1
      }
      out.push({ t: 'str', from: start, to: i, value: source.slice(start + 1, i - 1) })
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i
      i += 1
      while (i < source.length && /[\w$]/.test(source[i])) i += 1
      out.push({ t: 'id', from: start, to: i, value: source.slice(start, i) })
      continue
    }
    out.push({ t: 'punct', from: i, to: i + 1, value: c })
    i += 1
  }
  return out
}

function isIdent(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name)
}

function lookup(scope: Scope | null, name: string): Binding | null {
  let current: Scope | null = scope
  while (current) {
    const found = current.names.get(name)
    if (found) return found
    current = current.parent
  }
  return null
}

function bind(scope: Scope, tok: Tok & { t: 'id' }): Binding {
  const binding: Binding = { name: tok.value, spans: [{ from: tok.from, to: tok.to }] }
  scope.names.set(tok.value, binding)
  return binding
}

function recordUse(scope: Scope, tok: Tok & { t: 'id' }): void {
  const binding = lookup(scope, tok.value)
  if (binding) binding.spans.push({ from: tok.from, to: tok.to })
}

type Brace = 'block' | 'object' | 'class' | 'paren'

function analyze(source: string): { toks: Tok[]; bindings: Binding[] } {
  const toks = lex(source)
  const root: Scope = { parent: null, names: new Map() }
  const scopes: Scope[] = [root]
  const braces: Brace[] = []
  const bindings: Binding[] = []
  const current = (): Scope => scopes[scopes.length - 1]
  const pushScope = (): Scope => {
    const scope: Scope = { parent: current(), names: new Map() }
    scopes.push(scope)
    return scope
  }

  let i = 0
  let pendingBody = false
  const peek = (offset = 0): Tok | undefined => toks[i + offset]
  const prevSig = (before: number): Tok | undefined => {
    for (let k = before - 1; k >= 0; k -= 1) {
      const tok = toks[k]
      if (tok.t === 'punct' && tok.value === '\n') continue
      return tok
    }
    return undefined
  }

  const skipValue = (): void => {
    let depth = 0
    while (i < toks.length) {
      const tok = toks[i]
      if (tok.t === 'punct' && (tok.value === '(' || tok.value === '{' || tok.value === '['))
        depth += 1
      if (tok.t === 'punct' && (tok.value === ')' || tok.value === '}' || tok.value === ']')) {
        if (depth === 0) return
        depth -= 1
      }
      if (
        depth === 0 &&
        tok.t === 'punct' &&
        (tok.value === ',' || tok.value === ';' || tok.value === '\n')
      ) {
        return
      }
      i += 1
    }
  }

  const bindPattern = (scope: Scope): void => {
    const tok = peek()
    if (!tok) return
    if (tok.t === 'id') {
      bindings.push(bind(scope, tok))
      i += 1
      if (peek()?.t === 'punct' && peek()?.value === '=') {
        i += 1
        skipValue()
      }
      return
    }
    if (tok.t === 'punct' && (tok.value === '{' || tok.value === '[')) {
      const close = tok.value === '{' ? '}' : ']'
      i += 1
      while (i < toks.length) {
        const item = peek()
        if (!item) return
        if (item.t === 'punct' && item.value === close) {
          i += 1
          return
        }
        if (item.t === 'punct' && item.value === ',') {
          i += 1
          continue
        }
        if (item.t === 'id' && tok.value === '{') {
          const next = peek(1)
          if (next?.t === 'punct' && next.value === ':') {
            i += 2
            bindPattern(scope)
          } else {
            bindings.push(bind(scope, item))
            i += 1
          }
        } else {
          bindPattern(scope)
        }
        if (peek()?.t === 'punct' && peek()?.value === ',') i += 1
      }
    }
  }

  while (i < toks.length) {
    const tok = toks[i]
    if (tok.t === 'punct' && tok.value === '{') {
      const previous = prevSig(i)
      if (pendingBody) {
        pendingBody = false
        braces.push('block')
      } else if (
        (previous?.t === 'id' && CONTROL.has(previous.value)) ||
        (previous?.t === 'punct' && previous.value === ')')
      ) {
        pushScope()
        braces.push('block')
      } else {
        braces.push('object')
      }
      i += 1
      continue
    }
    if (tok.t === 'punct' && tok.value === '}') {
      const kind = braces.pop()
      if (kind === 'block' && scopes.length > 1) scopes.pop()
      i += 1
      continue
    }
    if (tok.t === 'punct' && (tok.value === '(' || tok.value === ')')) {
      i += 1
      continue
    }
    if (tok.t === 'punct' && tok.value === '\n') {
      i += 1
      continue
    }
    if (tok.t !== 'id') {
      i += 1
      continue
    }

    let k = i - 1
    while (k >= 0 && toks[k].t === 'punct' && toks[k].value === '\n') k -= 1
    if (toks[k]?.t === 'punct' && toks[k].value === '.') {
      i += 1
      continue
    }

    if (tok.value === 'function') {
      i += 1
      const name = peek()
      if (name?.t === 'id') {
        bindings.push(bind(current(), name))
        i += 1
      }
      const scope = pushScope()
      if (peek()?.t === 'punct' && peek()?.value === '(') {
        i += 1
        while (peek() && !(peek()!.t === 'punct' && peek()!.value === ')')) {
          if (peek()!.t === 'punct' && peek()!.value === ',') {
            i += 1
            continue
          }
          bindPattern(scope)
        }
        if (peek()?.t === 'punct' && peek()?.value === ')') i += 1
      }
      pendingBody = true
      continue
    }

    if (tok.value === 'const' || tok.value === 'let' || tok.value === 'var') {
      i += 1
      while (i < toks.length) {
        bindPattern(current())
        if (peek()?.t === 'punct' && peek()?.value === ',') {
          i += 1
          continue
        }
        break
      }
      continue
    }

    if (tok.value === 'catch' && peek()?.t === 'punct' && peek()?.value === '(') {
      const scope = pushScope()
      i += 2
      if (peek()?.t === 'id') {
        bindings.push(bind(scope, peek() as Tok & { t: 'id' }))
        i += 1
      }
      if (peek()?.t === 'punct' && peek()?.value === ')') i += 1
      pendingBody = true
      continue
    }

    if (
      braces[braces.length - 1] === 'object' &&
      peek(1)?.t === 'punct' &&
      peek(1)?.value === ':'
    ) {
      i += 1
      continue
    }

    recordUse(current(), tok)
    i += 1
  }

  return { toks, bindings }
}

function bindingFor(source: string, offset: number): Binding | null {
  const { bindings } = analyze(source)
  for (const binding of bindings) {
    if (binding.spans.some((span) => offset >= span.from && offset < span.to)) return binding
  }
  return null
}

export function definitionAt(source: string, offset: number): Span | null {
  const binding = bindingFor(source, offset)
  return binding?.spans[0] ?? null
}

export function renameAt(source: string, offset: number, nextName: string): string | null {
  if (!isIdent(nextName)) return null
  const binding = bindingFor(source, offset)
  if (!binding) return null
  const spans = [...binding.spans].sort((a, b) => b.from - a.from)
  let out = source
  for (const span of spans) out = `${out.slice(0, span.from)}${nextName}${out.slice(span.to)}`
  return out
}

export function importSpecAt(source: string, offset: number): string | null {
  const { toks } = analyze(source)
  const str = toks.find((tok) => tok.t === 'str' && offset >= tok.from && offset <= tok.to)
  if (!str || str.t !== 'str') return null
  const index = toks.indexOf(str)
  const before = toks
    .slice(Math.max(0, index - 6), index)
    .map((tok) => tok.value)
    .join('')
  if (!/(\$csv\(\s*|\$json\(\s*|require\(\s*|from\s*)$/.test(before)) return null
  return str.value
}
