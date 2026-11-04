import { inspect } from 'node:util'

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
      if (prop === inspect.custom || prop === 'toString' || prop === 'toJSON') return preview
      if (typeof prop !== 'string') return undefined
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

  Object.defineProperties(target, {
    $secret: { configurable: true, enumerable: true, value: $secret },
    $secrets: { configurable: true, enumerable: true, value: $secrets }
  })
}
