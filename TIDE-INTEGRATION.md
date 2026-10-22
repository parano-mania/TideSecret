# TideCloak integration plan — Plan C

This plan uses Tide MCP `tide_choose_playbook`, `add-rbac-nextjs` and `protect-api-nextjs` guidance. The current deliverable is a simulation: no realm is created, no real users enrolled, and no Tide service is required by the demo.

## Where TideCloak fits

| Boundary | Plan C implementation | Live integration point |
| --- | --- | --- |
| Sign-in/out | `/demo` selects owner or restricted role; sessionStorage holds the tab-local demo session | `TideCloakProvider` in `app/components/app-shell.tsx` and `useTideCloak` login/logout on live pages |
| Vault entry | Signed-out demo renders sign-in, no editor or note list | `proxy.ts` verifies access to `/home` and `/protected`; `app/home/layout.tsx` renders authenticated navigation |
| Application actions | Shared `demoAccessDecision` / `requireDemoPermission` policy guards mutations | Verified token realm/client roles enforced by each backend operation; UI role checks provide feedback only |
| Access-check demonstration | Public `POST /api/demo/access` returns simulated 200/401/403 decisions with no sensitive data | Verify signature, issuer, authorized client, time claims, roles and configured proof binding before data access |
| Encryption/decryption | Browser AES-GCM and IndexedDB device key | `doEncrypt([{ data, tags: ['secret'] }])` and `doDecrypt([{ encrypted, tags: ['secret'] }])` in the live vault |
| Note persistence | Ciphertext and metadata in demo-only localStorage namespace | Keep ciphertext-only storage, scoped to the verified subject and realm; enforce subject ownership if adding a backend |

## Proposed roles

App permissions are distinct from Tide encryption roles. These are planned realm roles, not claims that an existing realm has been configured.

| Action | Required roles (all required) | Demo owner | Restricted viewer | Signed out |
| --- | --- | --- | --- | --- |
| View ciphertext | `notes.view` | Allow | Allow | 401 |
| Encrypt | `notes.create`, `_tide_secret.selfencrypt` | Allow | 403 | 401 |
| Save | `notes.create` | Allow | 403 | 401 |
| Decrypt | `notes.view`, `_tide_secret.selfdecrypt` | Allow | 403 | 401 |
| Delete | `notes.delete` | Allow | 403 | 401 |

Owner and restricted viewer are two simulated permission sets over the same sample vault, not distinct real users. Tide self-encryption is user-bound: granting another user a self-decrypt role does not grant access to the first user's notes. A real second user needs a separate subject namespace and their own notes. Sharing requires a separate design.

## Access behavior implemented now

- Signing out clears plaintext, revealed text, payload selection and the displayed note list. Pending crypto results are discarded if the session changes.
- Every encryption/decryption and save/delete handler checks permissions before doing work. The policy distinguishes unauthenticated (401) and insufficient privileges (403).
- The access panel shows permissions and lets judges test owner, restricted and signed-out requests against the local server.
- The simulation endpoint accepts only known roles/actions and labels every response `simulated: true`; it never creates a live session or returns notes, keys or tokens.
- Live APIs do not accept demo roles. There is no fallback from failed live authentication to a simulated session.

## Before enabling a live deployment

1. Obtain the user's licence email and agreement to Tide's terms; choose hosting before realm provisioning. Neither is needed for this simulation.
2. Provision the realm using current Tide MCP guidance and export the adapter with embedded verification keys. The repository's `tidecloak.json` is currently `{}`.
3. Create the proposed app roles and approve/commit the `secret` encryption grants. The current starter realm template uses `message` roles, whereas the vault uses the `secret` tag; align these before provisioning.
4. Complete the current SDK's DPoP/provider/relay/server verification setup using Tide's shipped assets and current guidance. The preserved live API currently handles Bearer only and is not evidence of complete DPoP protection.
5. Replace the starter live API's `offline_access` requirement with the appropriate app role for each actual operation. `offline_access` is not a note-management privilege.
6. Run Tide doctor, fix its findings and verify real login, wrong-role rejection, expiry, sign-out, isolation between subjects and the encryption round trip. The live path has not been certified by this demo work.

The browser simulation is intentionally bypassable by its operator. No simulated role or response is production authorization. Local encryption does not reproduce Tide threshold key custody or cryptographic governance.
