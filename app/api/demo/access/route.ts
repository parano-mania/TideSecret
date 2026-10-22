import { demoAccessDecision, type DemoAction, type DemoRole } from '../../../../lib/demo-crypto'

// Public Plan C decision simulator, NOT authentication or a gateway to note data.
// Caller-selected roles are intentional. This endpoint never returns a token,
// plaintext, ciphertext or key and is never used by the live TideCloak paths.
export async function POST(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', 'X-TideSecret-Mode': 'simulated' }
  let input: unknown
  try { input = await request.json() }
  catch { return Response.json({ simulated: true, error: 'Expected a JSON role and action.' }, { status: 400, headers }) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Response.json({ simulated: true, error: 'Expected a role and action.' }, { status: 400, headers })
  }
  const { role, action } = input as Record<string, unknown>
  if ((role !== null && role !== 'owner' && role !== 'restricted')
    || typeof action !== 'string' || !['view', 'encrypt', 'save', 'decrypt', 'delete'].includes(action)) {
    return Response.json({ simulated: true, error: 'Unknown demo role or action.' }, { status: 400, headers })
  }
  const decision = demoAccessDecision(role as DemoRole | null, action as DemoAction)
  return Response.json({ simulated: true, ...decision }, { status: decision.status, headers })
}
