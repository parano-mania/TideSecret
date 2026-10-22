'use client'

import { useEffect, useRef, useState } from 'react'
import { Brand, LockIcon } from '../components/brand'
import { deleteEncryptedNote, readEncryptedNotes, saveEncryptedNote, type EncryptedNote } from '../../lib/encrypted-notes'
import { DEMO_NOTES_KEY, DEMO_SESSION_KEY, decryptDemoNote, encryptDemoNote, getDemoKey, requireDemoPermission, type DemoRole } from '../../lib/demo-crypto'

const disclosure = 'Plan C demo — TideCloak protections simulated.'

export default function DemoPage() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<DemoRole | null>(null)
  const [notes, setNotes] = useState<EncryptedNote[]>([])
  const [plaintext, setPlaintext] = useState('')
  const [ciphertext, setCiphertext] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const generation = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    try {
      const session = sessionStorage.getItem(DEMO_SESSION_KEY)
      if (session === 'owner' || session === 'restricted') {
        const saved = readEncryptedNotes(localStorage, DEMO_NOTES_KEY)
        setRole(session)
        setNotes(saved)
      }
    } catch { setError('Demo storage could not be read. Enable browser storage and reload. Existing notes have not been changed.') }
    setReady(true)
    return () => { generation.current++ }
  }, [])

  function clearSensitiveState() {
    generation.current++
    setPlaintext(''); setCiphertext(''); setDecrypted(''); setSelectedId(null)
    setPendingDelete(null); setError(''); setStatus('')
  }

  function signIn(nextRole: DemoRole) {
    try {
      const saved = readEncryptedNotes(localStorage, DEMO_NOTES_KEY)
      sessionStorage.setItem(DEMO_SESSION_KEY, nextRole)
      clearSensitiveState()
      setNotes(saved); setRole(nextRole)
    } catch { setError('Could not open demo storage. Enable browser storage and retry; existing data has not been changed.') }
  }

  function signOut() {
    clearSensitiveState()
    setRole(null); setNotes([])
    try { sessionStorage.removeItem(DEMO_SESSION_KEY) }
    catch { setError('Signed out on this page, but the saved demo session could not be removed. Close this tab to end it.') }
  }

  async function encrypt() {
    if (inFlight.current) return
    setError(''); setStatus('')
    try {
      requireDemoPermission(role, 'encrypt')
      if (!plaintext.trim()) throw new Error('Enter a note before encrypting.')
    } catch (cause) { setError((cause as Error).message); return }
    inFlight.current = true; setBusy(true)
    const current = generation.current
    try {
      const key = await getDemoKey()
      const result = await encryptDemoNote(role, key, plaintext)
      if (current !== generation.current) return
      setCiphertext(result); setPlaintext(''); setDecrypted(''); setSelectedId(null)
      setStatus('Encrypted locally with AES-GCM. Choose Save encrypted note to keep it in this browser.')
    } catch { if (current === generation.current) setError('Encryption failed. Use localhost or HTTPS and allow browser storage. Your input is still available.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  function save() {
    if (inFlight.current) return
    setError(''); setStatus('')
    try {
      requireDemoPermission(role, 'save')
      if (!ciphertext) throw new Error('Encrypt a note before saving.')
      const updated = saveEncryptedNote(localStorage, DEMO_NOTES_KEY, ciphertext)
      setNotes(updated); setSelectedId(updated[updated.length - 1].id)
      setStatus('Encrypted note saved. Plaintext is not in note storage. Notes survive reloads and sign-out on this browser.')
    } catch (cause) {
      setError(role !== 'owner' ? (cause as Error).message : 'Could not save the encrypted note. Check browser storage and retry; the payload remains available.')
    }
  }

  async function decrypt(note?: EncryptedNote) {
    if (inFlight.current) return
    setError(''); setStatus(''); setDecrypted('')
    const payload = note?.ciphertext ?? ciphertext
    try {
      requireDemoPermission(role, 'decrypt')
      if (!payload) throw new Error('Select a saved note or encrypt one first.')
    } catch (cause) { setError((cause as Error).message); return }
    inFlight.current = true; setBusy(true)
    const current = generation.current
    if (note) { setCiphertext(note.ciphertext); setSelectedId(note.id) }
    try {
      const key = await getDemoKey()
      const result = await decryptDemoNote(role, key, payload)
      if (current !== generation.current) return
      setDecrypted(result); setStatus('Note decrypted locally. Revealed text stays in page memory until cleared or signed out.')
    } catch { if (current === generation.current) setError('Could not decrypt this note. Its payload may be damaged or this browser may no longer have its demo key.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  function remove(id: string) {
    if (inFlight.current) return
    setError(''); setStatus('')
    try {
      requireDemoPermission(role, 'delete')
      setNotes(deleteEncryptedNote(localStorage, DEMO_NOTES_KEY, id))
      if (selectedId === id) { setCiphertext(''); setDecrypted(''); setSelectedId(null) }
      setPendingDelete(null); setStatus('Encrypted note deleted from this browser.')
    } catch { setError('Deletion failed. Check your demo permissions and browser storage.') }
  }

  if (!ready) return <main className="center-page"><p role="status">Loading offline demo…</p></main>
  if (!role) return <main className="center-page"><section className="auth-card" aria-labelledby="demo-title">
    <Brand /><p className="eyebrow">Offline prototype</p><h1 id="demo-title">Your vault. Ready to try.</h1>
    <p className="notice demo-notice">{disclosure}</p>
    <p className="auth-description">Choose a simulated role. No Tide account or network connection is needed.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="demo-actions"><button className="primary full" onClick={() => signIn('owner')} disabled={busy}>Sign in as demo owner</button>
    <button className="full" onClick={() => signIn('restricted')} disabled={busy}>Sign in as restricted viewer</button></div>
    <p className="auth-foot">Owner: encrypt, save, decrypt and delete. Restricted viewer: view ciphertext and demonstrate denied actions.</p>
    <p className="auth-foot">Encryption uses a key kept in this browser. Roles and login are simulated; they do not provide Tide's distributed security. Use sample notes.</p>
    <p className="auth-foot"><a href="/">Return to live TideCloak sign-in</a></p>
  </section></main>

  return <>
    <header className="topbar"><nav className="topbar-inner" aria-label="Demo navigation"><Brand /><div className="account"><span className="account-name">Demo {role === 'owner' ? 'owner' : 'restricted viewer'}</span><button onClick={signOut}>Sign out</button></div></nav></header>
    <main className="vault">
      <p className="notice demo-notice">{disclosure}</p>
      <div className="vault-heading"><div><p className="eyebrow">Offline vault</p><h1>A little space for your secrets.</h1><p>Create a note, encrypt it, save the payload, then reveal it when you need it.</p></div><span className="badge">Browser AES-GCM · Local device</span></div>
      <section className="notice" aria-label="Simulated permissions"><strong>Simulated permissions: </strong>{role === 'owner' ? 'Encrypt, save, decrypt and delete allowed.' : 'Ciphertext viewing allowed. Encrypt, save, decrypt and delete denied.'}
        <div className="demo-actions"><button onClick={() => { setError(''); try { requireDemoPermission('restricted', 'decrypt') } catch (cause) { setError((cause as Error).message) } }}>Try restricted decrypt (access denied)</button></div>
      </section>
      {error && <p className="notice error" role="alert">{error}</p>}
      <p role="status" aria-live="polite">{busy ? 'Working locally…' : status}</p>
      <div className="vault-grid">
        <section className="panel" aria-labelledby="compose-title"><div className="panel-head"><h2 id="compose-title">Create a secret note</h2><LockIcon width="20" height="20" /></div><div className="panel-body">
          <label htmlFor="demo-note">Note text</label><textarea id="demo-note" className="editor" value={plaintext} onChange={(event) => setPlaintext(event.target.value)} disabled={busy} placeholder="Try a sample secret…" autoComplete="off" spellCheck={false} maxLength={20000} />
          <div className="editor-footer"><span className="editor-hint">Plaintext is cleared after encryption and never saved to note storage.</span><button className="primary" onClick={() => void encrypt()} disabled={busy}>Encrypt note</button></div>
        </div></section>
        <section className="panel" aria-labelledby="saved-title"><div className="panel-head"><h2 id="saved-title">Saved encrypted notes</h2><span className="badge">{notes.length} notes</span></div>
          {notes.length === 0 && <div className="empty"><h3>Your demo vault is empty.</h3><p>Encrypt and save your first note to start.</p></div>}
          <ul className="note-list">{notes.map((note, index) => <li key={note.id} className={'note-row' + (selectedId === note.id ? ' selected' : '')}>
            <div className="note-top"><span className="note-title">Secret note {index + 1}</span><span className="badge">Encrypted</span></div>
            <time className="note-date" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time><span className="note-preview">{note.ciphertext}</span>
            <div className="note-actions"><button disabled={busy} onClick={() => { setCiphertext(note.ciphertext); setSelectedId(note.id); setDecrypted(''); setStatus('Saved ciphertext selected.'); setError('') }}>View payload</button><button disabled={busy} onClick={() => void decrypt(note)}>Decrypt</button><button className="danger" disabled={busy || role !== 'owner'} onClick={() => setPendingDelete(note.id)} aria-label={`Delete secret note ${index + 1}`}>Delete</button></div>
            {pendingDelete === note.id && <div className="notice demo-confirm"><p>Delete secret note {index + 1} from this browser? This cannot be undone.</p><div className="note-actions"><button onClick={() => setPendingDelete(null)}>Keep note</button><button className="danger" disabled={busy} onClick={() => remove(note.id)}>Confirm delete</button></div></div>}
          </li>)}</ul>
        </section>
      </div>
      <div className="output-grid">
        <section className="panel"><div className="panel-head"><h2>Encrypted payload</h2></div><div className="panel-body"><label htmlFor="demo-ciphertext">Ciphertext</label><textarea id="demo-ciphertext" value={ciphertext} readOnly rows={5} placeholder="Encrypted payload appears here." /><div className="output-foot"><p>Only ciphertext and note metadata are saved.</p><button onClick={save} disabled={busy || !ciphertext || selectedId !== null}>Save encrypted note</button></div></div></section>
        <section className="panel"><div className="panel-head"><h2>For your eyes</h2><span className="badge">In memory only</span></div><div className="panel-body"><label htmlFor="demo-decrypted">Decrypted note</label><textarea id="demo-decrypted" value={decrypted} readOnly rows={5} placeholder="Decrypt a note to reveal it." /><div className="output-foot"><button onClick={() => void decrypt()} disabled={busy || !ciphertext}>Decrypt selected note</button><button onClick={() => setDecrypted('')} disabled={!decrypted}>Hide revealed text</button></div></div></section>
      </div>
      <footer className="vault-footer"><span>Simulated identity and permissions. Local browser encryption.</span><span>Demo keys and notes stay on this device. Clearing site data removes them.</span></footer>
    </main>
  </>
}
