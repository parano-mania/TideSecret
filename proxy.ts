import { NextResponse } from 'next/server'
import { createTideCloakProxy } from '@tidecloak/nextjs/server'
import type { TidecloakConfig } from '@tidecloak/nextjs/server'
import { isTidecloakConfigured } from './lib/tidecloak'
import rawConfig from './tidecloak.json'

// An empty role list still requires a verified token. Keep the starter's
// existing role requirement for its separate /protected example.
export const proxy = createTideCloakProxy({
  // The starter ships {} until provisioning finishes. onRequest rejects
  // requests before verification while that placeholder is still present.
  config: rawConfig as TidecloakConfig,
  protectedRoutes: {
    '/home/*': [],
    '/protected/*': ['offline_access'],
  },
  onRequest: ({ token }, req) => {
    if (!isTidecloakConfigured || !token) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  },
  onFailure: (_ctx, req) => {
    const response = NextResponse.redirect(new URL('/?auth=failed', req.url))
    response.cookies.delete('kcToken')
    return response
  },
  onError: (_err, req) => NextResponse.redirect(new URL('/?auth=failed', req.url)),
})

export const config = {
  matcher: ['/home/:path*', '/protected/:path*'],
}
