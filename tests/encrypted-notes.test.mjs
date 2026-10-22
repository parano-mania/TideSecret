import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteEncryptedNote, noteStorageKey, readEncryptedNotes, saveEncryptedNote } from '../lib/encrypted-notes.ts'

// These fixtures test serialization only. They are NOT ciphertext produced by
// TideCloak and must never be cited as proof of real encryption/decryption.
const fixture = 'serialization-only fixture: "quoted" \\ slash\n雪'
const config = { 'auth-server-url': 'http://localhost:8080', realm: 'test', resource: 'client' }
const key = noteStorageKey(config, 'user-one')

class MemoryStorage {
  data = new Map()
  getItem(key) { return this.data.get(key) ?? null }
  setItem(key, value) { this.data.set(key, value) }
}

test('JSON preserves the exact opaque string across a fresh read', () => {
  const storage = new MemoryStorage()
  const saved = saveEncryptedNote(storage, key, fixture)
  assert.equal(readEncryptedNotes(storage, key)[0].ciphertext, fixture)
  assert.deepEqual(readEncryptedNotes(storage, key), saved)
})

test('persisted schema contains only payload and approved metadata', () => {
  const storage = new MemoryStorage()
  saveEncryptedNote(storage, key, fixture)
  const parsed = JSON.parse(storage.getItem(key))
  assert.deepEqual(Object.keys(parsed).sort(), ['notes', 'version'])
  assert.deepEqual(Object.keys(parsed.notes[0]).sort(), ['ciphertext', 'createdAt', 'id', 'tags'])
  assert.deepEqual(parsed.notes[0].tags, ['secret'])
  for (const forbidden of ['plaintext', 'decrypted', 'accessToken', 'token', 'idToken']) {
    assert.equal(Object.hasOwn(parsed.notes[0], forbidden), false)
  }
})

test('delete survives a subsequent fresh read and preserves other records', () => {
  const storage = new MemoryStorage()
  const first = saveEncryptedNote(storage, key, fixture)[0]
  const before = saveEncryptedNote(storage, key, 'second serialization-only fixture')
  deleteEncryptedNote(storage, key, first.id)
  assert.deepEqual(readEncryptedNotes(storage, key), [before[1]])
  deleteEncryptedNote(storage, key, before[1].id)
  assert.deepEqual(readEncryptedNotes(storage, key), [])
})

test('account, realm, client, and server namespaces stay separate', () => {
  const storage = new MemoryStorage()
  saveEncryptedNote(storage, key, fixture)
  const otherKeys = [
    noteStorageKey(config, 'user-two'),
    noteStorageKey({ ...config, realm: 'other' }, 'user-one'),
    noteStorageKey({ ...config, resource: 'other' }, 'user-one'),
    noteStorageKey({ ...config, 'auth-server-url': 'http://localhost:8081' }, 'user-one'),
  ]
  for (const otherKey of otherKeys) assert.deepEqual(readEncryptedNotes(storage, otherKey), [])
})

test('namespace escaping prevents delimiter collisions and rejects missing config', () => {
  assert.notEqual(noteStorageKey(config, 'a:b'), noteStorageKey(config, 'a%3Ab'))
  assert.throws(() => noteStorageKey({}, 'user-one'))
})

test('a save reads latest storage rather than overwriting an earlier tab save', () => {
  const storage = new MemoryStorage()
  const first = saveEncryptedNote(storage, key, fixture)
  const second = saveEncryptedNote(storage, key, 'another serialization-only fixture')
  assert.equal(second.length, 2)
  assert.deepEqual(second[0], first[0])
})

test('malformed JSON is never silently overwritten by save or delete', () => {
  const storage = new MemoryStorage()
  storage.setItem(key, '{ damaged data')
  assert.throws(() => readEncryptedNotes(storage, key))
  assert.throws(() => saveEncryptedNote(storage, key, fixture))
  assert.throws(() => deleteEncryptedNote(storage, key, 'any-id'))
  assert.equal(storage.getItem(key), '{ damaged data')
})

test('unknown versions, wrong tags, extra fields and duplicate IDs fail closed', () => {
  const storage = new MemoryStorage()
  const note = saveEncryptedNote(storage, key, fixture)[0]
  for (const value of [
    { version: 2, notes: [note] },
    { version: 1, notes: [{ ...note, tags: ['other'] }] },
    { version: 1, notes: [{ ...note, plaintext: 'must not be re-saved' }] },
    { version: 1, notes: [note, note] },
    { version: 1, notes: [{ ...note, createdAt: 'not a date' }] },
  ]) {
    const original = JSON.stringify(value)
    storage.setItem(key, original)
    assert.throws(() => readEncryptedNotes(storage, key))
    assert.throws(() => saveEncryptedNote(storage, key, fixture))
    assert.equal(storage.getItem(key), original)
  }
})

test('storage write failure leaves previously saved records intact', () => {
  const storage = new MemoryStorage()
  saveEncryptedNote(storage, key, fixture)
  const before = storage.getItem(key)
  storage.setItem = () => { throw new Error('quota exceeded') }
  assert.throws(() => saveEncryptedNote(storage, key, 'serialization-only retry fixture'))
  assert.throws(() => deleteEncryptedNote(storage, key, readEncryptedNotes(storage, key)[0].id))
  assert.equal(storage.getItem(key), before)
})

test('empty payload and blocked storage are rejected', () => {
  const storage = new MemoryStorage()
  assert.throws(() => saveEncryptedNote(storage, key, ''))
  assert.equal(storage.getItem(key), null)
  const blocked = { getItem() { throw new Error('storage denied') } }
  assert.throws(() => readEncryptedNotes(blocked, key))
})
