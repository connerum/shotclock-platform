import { NextRequest, NextResponse } from 'next/server';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(request: NextRequest) {
  if (UNSAFE_METHODS.has(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
      const expectedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
      if (origin !== expectedOrigin) {
        return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export const config = { matcher: ['/api/:path*'] };
