const DB_NAME = 'cleanstream-vault'
const DB_VERSION = 1
const PBKDF2_ITERATIONS = 310_000
const IV_LENGTH = 12

export const VAULT_LOCKED_ERROR = 'VAULT_LOCKED'

type DeviceSecret = { type: 'device'; jwk: JsonWebKey }
type PassphraseSecret = { type: 'passphrase'; salt: string; wrapped: string; iterations: number }
type SecretRecord = DeviceSecret | PassphraseSecret

const memory = {
  secret: null as SecretRecord | null,
  sessionKey: null as CryptoKey | null,
  data: new Map<string, string>(),
}

function subtle(): SubtleCrypto {
  const cryptoApi = globalThis.crypto?.subtle
  if (!cryptoApi) throw new Error('Web Crypto is required for encrypted storage.')
  return cryptoApi
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function generateDataKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

async function importDataKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey('jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const cipher = await subtle().encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, new TextEncoder().encode(plaintext))
  return `cs1.${bytesToB64(iv)}.${bytesToB64(new Uint8Array(cipher))}`
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const [version, ivPart, dataPart] = payload.split('.')
  if (version !== 'cs1' || !ivPart || !dataPart) throw new Error('Vault data is not a MyTube ciphertext.')
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(b64ToBytes(ivPart)) },
    key,
    toArrayBuffer(b64ToBytes(dataPart)),
  )
  return new TextDecoder().decode(plain)
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('secrets')) db.createObjectStore('secrets')
      if (!db.objectStoreNames.contains('data')) db.createObjectStore('data')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the encrypted vault.'))
  })
}

function idbGet<T>(store: 'secrets' | 'data', key: string): Promise<T | undefined> {
  if (!hasIndexedDb()) {
    if (store === 'secrets') return Promise.resolve((memory.secret as T | null) ?? undefined)
    return Promise.resolve(memory.data.get(key) as T | undefined)
  }
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const request = tx.objectStore(store).get(key)
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error)
      }),
  )
}

function idbSet(store: 'secrets' | 'data', key: string, value: unknown): Promise<void> {
  if (!hasIndexedDb()) {
    if (store === 'secrets') memory.secret = value as SecretRecord
    else memory.data.set(key, String(value))
    return Promise.resolve()
  }
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function idbDelete(store: 'secrets' | 'data', key: string): Promise<void> {
  if (!hasIndexedDb()) {
    if (store === 'secrets') memory.secret = null
    else memory.data.delete(key)
    return Promise.resolve()
  }
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

async function derivePassphraseKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function vaultStatus(): Promise<'uninitialized' | 'unlocked' | 'locked'> {
  if (memory.sessionKey) return 'unlocked'
  const secret = await idbGet<SecretRecord>('secrets', 'master')
  if (!secret) return 'uninitialized'
  return secret.type === 'passphrase' ? 'locked' : 'unlocked'
}

export function isVaultUnlocked(): boolean {
  return Boolean(memory.sessionKey)
}

async function ensureDeviceKey(): Promise<CryptoKey> {
  if (memory.sessionKey) return memory.sessionKey
  const secret = await idbGet<SecretRecord>('secrets', 'master')
  if (!secret) {
    const key = await generateDataKey()
    const jwk = await subtle().exportKey('jwk', key)
    await idbSet('secrets', 'master', { type: 'device', jwk } satisfies DeviceSecret)
    memory.sessionKey = key
    return key
  }
  if (secret.type === 'passphrase') {
    throw Object.assign(new Error('Unlock MyTube with your passphrase.'), { code: VAULT_LOCKED_ERROR })
  }
  const key = await importDataKey(secret.jwk)
  memory.sessionKey = key
  return key
}

export async function unlockVault(passphrase: string): Promise<void> {
  const secret = await idbGet<SecretRecord>('secrets', 'master')
  if (!secret || secret.type !== 'passphrase') {
    await ensureDeviceKey()
    return
  }
  const wrapKey = await derivePassphraseKey(passphrase, b64ToBytes(secret.salt), secret.iterations)
  const [ivPart, dataPart] = secret.wrapped.split(':')
  if (!ivPart || !dataPart) throw new Error('Passphrase vault is damaged.')
  try {
    const raw = await subtle().decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(b64ToBytes(ivPart)) },
      wrapKey,
      toArrayBuffer(b64ToBytes(dataPart)),
    )
    const key = await subtle().importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
    memory.sessionKey = key
  } catch {
    throw new Error('That passphrase does not unlock this device vault.')
  }
}

export async function protectVaultWithPassphrase(passphrase: string): Promise<void> {
  const trimmed = passphrase.trim()
  if (trimmed.length < 8) throw new Error('Use at least 8 characters for the vault passphrase.')
  const key = await ensureDeviceKey()
  const raw = await subtle().exportKey('raw', key)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const wrapKey = await derivePassphraseKey(trimmed, salt, PBKDF2_ITERATIONS)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const wrapped = await subtle().encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, wrapKey, raw)
  await idbSet('secrets', 'master', {
    type: 'passphrase',
    salt: bytesToB64(salt),
    wrapped: `${bytesToB64(iv)}:${bytesToB64(new Uint8Array(wrapped))}`,
    iterations: PBKDF2_ITERATIONS,
  } satisfies PassphraseSecret)
  memory.sessionKey = key
}

export async function removeVaultPassphrase(): Promise<void> {
  const key = await ensureDeviceKey()
  const jwk = await subtle().exportKey('jwk', key)
  await idbSet('secrets', 'master', { type: 'device', jwk } satisfies DeviceSecret)
}

export async function readVaultRecord(recordKey: string): Promise<string | null> {
  const key = await ensureDeviceKey()
  const payload = await idbGet<string>('data', recordKey)
  if (!payload) return null
  return decryptString(key, payload)
}

export async function writeVaultRecord(recordKey: string, plaintext: string): Promise<void> {
  const key = await ensureDeviceKey()
  const payload = await encryptString(key, plaintext)
  await idbSet('data', recordKey, payload)
}

export async function deleteVaultRecord(recordKey: string): Promise<void> {
  await idbDelete('data', recordKey)
}

export async function wipeVault(): Promise<void> {
  memory.sessionKey = null
  memory.secret = null
  memory.data.clear()
  if (!hasIndexedDb()) return
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

export function resetVaultMemory(): void {
  memory.sessionKey = null
}

export { PBKDF2_ITERATIONS }
