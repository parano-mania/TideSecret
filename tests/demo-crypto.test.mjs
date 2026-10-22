import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptDemoNote, decryptDemoNote, requireDemoPermission, DEMO_NOTES_KEY } from '../lib/demo-crypto.ts'
import { readEncryptedNotes, saveEncryptedNote, deleteEncryptedNote } from '../lib/encrypted-notes.ts'

const newKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

test('demo encrypt, persist, reload, decrypt and delete round trip without plaintext in storage', async () => {
  const key = await newKey()
  const plaintext = 'Sample secret: tiếng Việt 🔒'
  const payload = await encryptDemoNote('owner', key, plaintext)
  const values = new Map()
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
  saveEncryptedNote(storage, DEMO_NOTES_KEY, payload)
  assert.ok(!storage.getItem(DEMO_NOTES_KEY).includes(plaintext))
  const restored = readEncryptedNotes(storage, DEMO_NOTES_KEY)[0]
  assert.equal(await decryptDemoNote('owner', key, restored.ciphertext), plaintext)
  deleteEncryptedNote(storage, DEMO_NOTES_KEY, restored.id)
  assert.deepEqual(readEncryptedNotes(storage, DEMO_NOTES_KEY), [])
})

test('same plaintext receives fresh random IVs and distinct ciphertext', async () => {
  const key = await newKey()
  assert.notEqual(await encryptDemoNote('owner', key, 'sample'), await encryptDemoNote('owner', key, 'sample'))
})

test('modified ciphertext and a different browser key cannot decrypt a note', async () => {
  const key = await newKey()
  const payload = await encryptDemoNote('owner', key, 'sample')
  await assert.rejects(decryptDemoNote('owner', await newKey(), payload))
  const tampered = JSON.parse(payload)
  tampered.data = (tampered.data[0] === 'A' ? 'B' : 'A') + tampered.data.slice(1)
  await assert.rejects(decryptDemoNote('owner', key, JSON.stringify(tampered)))
})

test('restricted and signed-out sessions are denied independently of UI controls', async () => {
  const key = await newKey()
  const payload = await encryptDemoNote('owner', key, 'sample')
  for (const role of ['restricted', null]) {
    for (const action of ['encrypt', 'save', 'decrypt', 'delete']) {
      assert.throws(() => requireDemoPermission(role, action), /Access denied/)
    }
    await assert.rejects(encryptDemoNote(role, key, 'sample'), /Access denied/)
    await assert.rejects(decryptDemoNote(role, key, payload), /Access denied/)
  }
})
