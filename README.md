# TideSecret

A private-notes prototype built with Next.js, React and TypeScript. Includes a working offline Plan C demo and a separate TideCloak integration path.

**Plan C demo — TideCloak protections simulated.**

## Run locally

Use Node.js 22.18+ (or Node.js 24 LTS) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000/demo. No Tide account, server or network is required for the demo workflow once dependencies are installed and the app is running.

## Demo features

- Simulated owner and restricted-viewer sign-in, sign-out and tab-local sessions.
- Create, encrypt, save, decrypt and delete notes, with deletion confirmation.
- AES-256-GCM browser encryption with a fresh random IV per encryption.
- Persistent local ciphertext and a browser-stored, non-extractable CryptoKey.
- Ciphertext previews, timestamps, reveal/hide controls and access-denied examples.
- Responsive layout and clear simulation disclosures.

See [PLAN-C.md](PLAN-C.md) for a walkthrough and storage details.

## Security boundaries

Demo authentication and permissions are browser-controlled simulations. They do not establish real identities or provide production access control. Use sample notes. This demo does not reproduce Tide's distributed cryptographic protections.

Only ciphertext and note metadata are written to note storage. The demo key persists in IndexedDB; code running on the same origin can use it. Notes are specific to this browser and origin. Clearing site data removes notes and keys. There is no cloud synchronization, sharing or key recovery.

## Live integration

The original TideCloak routes and server-side token verification remain separate from `/demo`. `tidecloak.json` currently contains an empty configuration placeholder, so live sign-in requires TideCloak provisioning and configuration. Demo roles never grant access to live APIs. Demo ciphertext and live Tide ciphertext are incompatible.

Keep credentials in local environment files and never commit passwords, tokens or private keys. Review the existing `init/` provisioning template before using it with a live environment; it contains starter defaults. No provisioning is needed for the Plan C demo.

## Validation

```sh
npm run build
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test tests/encrypted-notes.test.mjs tests/demo-crypto.test.mjs
```

The tests cover note persistence/deletion, plaintext exclusion from saved records, encryption round trips, modified-ciphertext rejection and denied operations.

For a production build locally:

```sh
npm run build
npm start
```

Browser encryption requires localhost or HTTPS. Publishing source to GitHub does not deploy a running website; use a Next.js-compatible host to publish the app.
