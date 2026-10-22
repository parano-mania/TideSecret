export interface EncryptedNote {
  id: string
  createdAt: string
  ciphertext: string
  tags: ['secret']
}

type NoteStorage = Pick<Storage, 'getItem' | 'setItem'>

export function noteStorageKey(config: Record<string, unknown>, subject: string): string {
  const scope = [config['auth-server-url'], config.realm, config.resource, subject]
  if (scope.some((part) => typeof part !== 'string' || !part.trim())) {
    throw new Error('A configured TideCloak account is required for note storage')
  }
  // These are stable public account identifiers, never session tokens or keys.
  return `tidesecret:notes:v1:${scope.map((part) => encodeURIComponent(part as string)).join(':')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNote(value: unknown): value is EncryptedNote {
  return isRecord(value)
    && Object.keys(value).sort().join(',') === 'ciphertext,createdAt,id,tags'
    && typeof value.id === 'string' && value.id.length > 0
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && typeof value.ciphertext === 'string' && value.ciphertext.length > 0
    && Array.isArray(value.tags) && value.tags.length === 1 && value.tags[0] === 'secret'
}

export function readEncryptedNotes(storage: Pick<Storage, 'getItem'>, key: string): EncryptedNote[] {
  const raw = storage.getItem(key)
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'notes,version'
    || value.version !== 1 || !Array.isArray(value.notes) || !value.notes.every(isNote)
    || new Set(value.notes.map((note) => note.id)).size !== value.notes.length) {
    throw new Error('Saved encrypted notes have an unsupported or damaged format')
  }
  return value.notes
}

function writeEncryptedNotes(storage: NoteStorage, key: string, notes: EncryptedNote[]): void {
  // Whitelist persisted fields; never serialize a component state object.
  const records = notes.map((note) => ({
    id: note.id,
    createdAt: note.createdAt,
    ciphertext: note.ciphertext,
    tags: ['secret'],
  }))
  storage.setItem(key, JSON.stringify({ version: 1, notes: records }))
}

export function saveEncryptedNote(storage: NoteStorage, key: string, ciphertext: string): EncryptedNote[] {
  if (typeof ciphertext !== 'string' || !ciphertext) throw new Error('Ciphertext is required')
  // Read immediately before a write so another tab's earlier saves are kept.
  // localStorage still offers no transaction or simultaneous-write guarantee.
  const existing = readEncryptedNotes(storage, key)
  const note: EncryptedNote = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    ciphertext,
    tags: ['secret'],
  }
  if (existing.some((entry) => entry.id === note.id)) throw new Error('Please retry saving the note')
  const updated = [...existing, note]
  writeEncryptedNotes(storage, key, updated)
  return updated
}

export function deleteEncryptedNote(storage: NoteStorage, key: string, id: string): EncryptedNote[] {
  const updated = readEncryptedNotes(storage, key).filter((note) => note.id !== id)
  writeEncryptedNotes(storage, key, updated)
  return updated
}
