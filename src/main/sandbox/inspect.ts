// A small `util.inspect` for the script sandbox. It runs inside the vm context, so it must not
// import anything from Node.

const custom = Symbol.for('nodejs.util.inspect.custom')

export type InspectOptions = { depth?: number; breakLength?: number; colors?: boolean }

type Seen = { stack: object[] }

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

function quote(text: string): string {
  const mark = text.includes("'") && !text.includes('"') ? '"' : "'"
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(new RegExp(mark, 'g'), `\\${mark}`)
  return `${mark}${escaped}${mark}`
}

function keyText(key: string | symbol): string {
  if (typeof key === 'symbol') return `[${String(key)}]`
  return IDENTIFIER.test(key) ? key : quote(key)
}

function functionText(value: (...args: unknown[]) => unknown): string {
  let source = ''
  try {
    source = Function.prototype.toString.call(value)
  } catch {
    source = ''
  }
  if (source.startsWith('class')) return `[class ${value.name || '(anonymous)'}]`
  return value.name ? `[Function: ${value.name}]` : '[Function (anonymous)]'
}

function constructorName(value: object): string | null {
  const proto = Object.getPrototypeOf(value)
  if (proto === null) return null
  const ctor = (proto as { constructor?: { name?: unknown } }).constructor
  return ctor && typeof ctor.name === 'string' ? ctor.name : ''
}

function wrap(open: string, items: string[], close: string, indent: number, width: number): string {
  if (items.length === 0) return `${open}${close}`
  const line = `${open} ${items.join(', ')} ${close}`
  if (line.length + indent <= width && !line.includes('\n')) return line
  const pad = ' '.repeat(indent + 2)
  return `${open}\n${items.map((item) => `${pad}${item}`).join(',\n')}\n${' '.repeat(indent)}${close}`
}

function format(value: unknown, depth: number, indent: number, seen: Seen, width: number): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
      return quote(value)
    case 'number':
      return Object.is(value, -0) ? '-0' : String(value)
    case 'bigint':
      return `${value}n`
    case 'boolean':
    case 'undefined':
      return String(value)
    case 'symbol':
      return value.toString()
    case 'function':
      return functionText(value as (...args: unknown[]) => unknown)
  }

  const object = value as Record<string | symbol, unknown>
  let hook: unknown
  try {
    hook = object[custom]
  } catch {
    hook = undefined
  }
  if (typeof hook === 'function') {
    const text = (hook as (depth: number) => unknown).call(value, depth)
    return typeof text === 'string' ? text : format(text, depth, indent, seen, width)
  }

  if (seen.stack.includes(object)) return '[Circular]'
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  }
  if (value instanceof RegExp) return String(value)
  if (value instanceof Error) {
    return typeof value.stack === 'string' && value.stack
      ? value.stack
      : `${value.name}: ${value.message}`
  }
  if (value instanceof Promise) return 'Promise { <pending> }'
  if (value instanceof WeakMap) return 'WeakMap { <items unknown> }'
  if (value instanceof WeakSet) return 'WeakSet { <items unknown> }'

  const isArray = Array.isArray(value)
  if (depth < 0) {
    if (isArray) return '[Array]'
    const name = constructorName(object)
    return `[${name || 'Object'}]`
  }

  seen.stack.push(object)
  try {
    const next = (item: unknown): string => format(item, depth - 1, indent + 2, seen, width)
    if (value instanceof Map) {
      const items = [...value].map(([key, item]) => `${next(key)} => ${next(item)}`)
      return wrap(`Map(${value.size}) {`, items, '}', indent, width)
    }
    if (value instanceof Set) {
      return wrap(`Set(${value.size}) {`, [...value].map(next), '}', indent, width)
    }
    if (isArray) {
      const list = value as unknown[]
      const shown = list.slice(0, 100).map(next)
      if (list.length > 100) shown.push(`... ${list.length - 100} more items`)
      return wrap('[', shown, ']', indent, width)
    }
    const items: string[] = []
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key)
      if (!descriptor || !descriptor.enumerable) continue
      if ('value' in descriptor) items.push(`${keyText(key)}: ${next(descriptor.value)}`)
      else items.push(`${keyText(key)}: [Getter${descriptor.set ? '/Setter' : ''}]`)
    }
    const name = constructorName(object)
    const prefix =
      name === null ? '[Object: null prototype] ' : name && name !== 'Object' ? `${name} ` : ''
    return wrap(`${prefix}{`, items, '}', indent, width)
  } finally {
    seen.stack.pop()
  }
}

/** Formats a value the way `console.log` shows it. */
export function inspect(value: unknown, options: InspectOptions = {}): string {
  try {
    return format(value, options.depth ?? 2, 0, { stack: [] }, options.breakLength ?? 80)
  } catch (error) {
    return `[Uninspectable: ${error instanceof Error ? error.message : String(error)}]`
  }
}

inspect.custom = custom as typeof custom
