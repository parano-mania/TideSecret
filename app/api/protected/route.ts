import { NextRequest, NextResponse } from 'next/server'
import { verifyTideCloakToken } from '@tidecloak/nextjs/server'
import tcConfig from '../../../tidecloak.json'
import { isTidecloakConfigured } from '../../../lib/tidecloak'

const ALLOWED_ROLE = 'offline_access'

// Accepts plain Bearer tokens only. If you turn on useDPoP, call this with
// secureFetch and extend it to accept the DPoP scheme and validate the proof server-side.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401 }
    )
  }

  const token = authHeader.split(' ')[1]

  if (!isTidecloakConfigured) {
    return NextResponse.json({ error: 'Authentication setup is incomplete' }, { status: 503 })
  }

  try {
    const user = await verifyTideCloakToken(tcConfig, token, [ALLOWED_ROLE])

    if (!user) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid token or insufficient role' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { authenticated: true },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
