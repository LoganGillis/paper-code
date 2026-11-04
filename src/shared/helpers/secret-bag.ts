import { inspect } from 'node:util'

const secretBags = new WeakSet<object>()

/** True for the `$secrets` proxy, which must never be walked or sent out of the runner. */
export function isSecretBag(value: unknown): boolean {
  return typeof value === 'object' && value !== null && secretBags.has(value)
}

/** Keys the runtime probes on any returned value (`then` for await, coercion, JSON, etc.). */
const NOT_SECRETS = new Set(['then', 'catch', 'finally', 'valueOf', 'constructor', '__proto__'])

export function installSecretHelpers(
  target: Record<string, unknown>,
  bag: Record<string, string>
): void {
  const read = (name: string): string => {
    if (!Object.prototype.hasOwnProperty.call(bag, name)) {
      throw new Error(`No secret named "${name}" in this space`)
    }
    return bag[name]
  }

  const $secret = (name: unknown): string => {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('Use $secret("NAME")')
    }
    return read(name)
  }

  const names = (): string[] => Object.keys(bag).sort()
  const preview = (): string => {
    const keys = names()
    return keys.length === 0 ? '$secrets {}' : `$secrets { ${keys.join(', ')} }`
  }

  const $secrets = new Proxy(Object.create(null) as Record<string, string>, {
    get(_target, prop) {
      if (prop === inspect.custom || prop === 'toString') return preview
      if (prop === 'toJSON') return names
      // Promise, coercion, and other probes read these; they are never secrets.
      if (typeof prop !== 'string' || NOT_SECRETS.has(prop)) return undefined
      return read(prop)
    },
    has(_target, prop) {
      return typeof prop === 'string' && Object.prototype.hasOwnProperty.call(bag, prop)
    },
    ownKeys() {
      return names()
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(bag, prop)) {
        return { configurable: true, enumerable: true }
      }
      return undefined
    }
  })

  secretBags.add($secrets)

  Object.defineProperties(target, {
    $secret: { configurable: true, enumerable: true, value: $secret },
    $secrets: { configurable: true, enumerable: true, value: $secrets }
  })
}
