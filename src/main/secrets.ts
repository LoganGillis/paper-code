import { safeStorage } from 'electron'
import { installSecretHelpers } from '../shared/helpers/secret-bag'

export { installSecretHelpers }

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


