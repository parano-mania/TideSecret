# Plan C demo

Run `npm run dev`, then open http://localhost:3000/demo. The sign-in/setup page also links to the demo.

1. Sign in as demo owner. Create a sample note, click **Encrypt note**, then **Save encrypted note**.
2. Reload. Select **Decrypt** on the saved note to recover the original text.
3. Click **Try restricted decrypt (access denied)** to show a denied operation.
4. Sign out, then sign in as restricted viewer. Ciphertext is visible; encryption/decryption operations are rejected by the demo permission functions.
5. Sign out and return as owner. Delete a note and confirm; reload to verify deletion.

Authentication and permission checks are simulations. They use a tab-local sessionStorage role, which can be changed by the person controlling the browser. This route has no protected backend and grants no live API access. It does not provide Tide distributed key custody, verified identities, or production authorization.

Notes use browser AES-256-GCM with a fresh random IV for each encryption. A non-extractable CryptoKey is stored in the separate `tidesecret-plan-c` IndexedDB database. Encrypted payloads and metadata are stored under `tidesecret:plan-c:notes:v1` in localStorage. No plaintext is written to note storage. Same-origin code can use the key; use sample data. Notes and keys persist after sign-out and are specific to this browser/origin. Clearing site data removes them; losing the key makes saved ciphertext unreadable.

The `/demo` route does not mount the TideCloak provider or call Tide services. Live `/home`, `/protected`, and API verification remain unchanged. Return to `/` for live sign-in once TideCloak is configured. Demo sessions never substitute for live tokens, and demo ciphertext is incompatible with Tide ciphertext.
