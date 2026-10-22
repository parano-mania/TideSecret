// Local browser encryption for Plan C only. This does not implement Tide MPC.
export type DemoRole = 'owner' | 'restricted'
export type DemoAction = 'encrypt' | 'save' | 'decrypt' | 'delete'
export const DEMO_NOTES_KEY = 'tidesecret:plan-c:notes:v1'
export const DEMO_SESSION_KEY = 'tidesecret:plan-c:session:v1'

export function requireDemoPermission(role: DemoRole | null, action: DemoAction): void {
  if (role !== 'owner') throw new Error(`Access denied: the ${role ?? 'signed-out'} demo role cannot ${action} notes.`)
}

function encode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

export async function encryptDemoNote(role: DemoRole | null, key: CryptoKey, plaintext: string): Promise<string> {
  requireDemoPermission(role, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return JSON.stringify({ version: 'plan-c-aes-gcm-v1', iv: encode(iv), data: encode(new Uint8Array(data)) })
}

export async function decryptDemoNote(role: DemoRole | null, key: CryptoKey, ciphertext: string): Promise<string> {
  requireDemoPermission(role, 'decrypt')
  const payload = JSON.parse(ciphertext)
  if (payload?.version !== 'plan-c-aes-gcm-v1' || typeof payload.iv !== 'string' || typeof payload.data !== 'string') {
    throw new Error('Unsupported demo payload')
  }
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(payload.iv) }, key, decode(payload.data))
  return new TextDecoder().decode(data)
}

// IndexedDB can persist a non-extractable CryptoKey across reloads/sign-outs.
// Code running on this origin can still use it: this is device-local demo storage.
export async function getDemoKey(): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error('Browser encryption requires localhost or HTTPS.')
  const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tidesecret-plan-c', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('keys')
    request.onerror = () => reject(new Error('Demo key storage is unavailable.'))
    request.onblocked = () => reject(new Error('Close other demo tabs and retry.'))
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      const transaction = db.transaction('keys', 'readwrite')
      const store = transaction.objectStore('keys')
      const read = store.get('vault')
      let key: CryptoKey
      read.onsuccess = () => {
        key = read.result ?? candidate
        if (!read.result) store.put(key, 'vault')
      }
      transaction.oncomplete = () => { db.close(); resolve(key) }
      transaction.onabort = () => { db.close(); reject(new Error('Demo key storage failed.')) }
      transaction.onerror = () => { db.close(); reject(new Error('Demo key storage failed.')) }
    }
  })
}
