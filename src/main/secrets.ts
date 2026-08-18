import { inspect } from 'node:util'
import { safeStorage } from 'electron'

const PLAIN = 'plain:'
const ENC = 'enc:'

export function isSecretEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function sealSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'This computer cannot seal secrets. Unlock the OS keychain and try again — Paper will not store API keys in plaintext.'
    )
  }
  return ENC + safeStorage.encryptString(value).toString('base64')
}

export function unsealSecret(stored: string): string {
  if (stored.startsWith(ENC)) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS encryption is unavailable, so this secret cannot be read.')
    }
    return safeStorage.decryptString(Buffer.from(stored.slice(ENC.length), 'base64'))
  }
  if (stored.startsWith(PLAIN)) {
    return stored.slice(PLAIN.length)
  }
  return stored
}

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
