// Server-side GitHub OAuth authorization URL generator following popup-based flow

import crypto from 'node:crypto';
import { signState } from '../../../lib/serverCrypto';
import { resolveRequestOrigin } from '../../../lib/githubPushService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
  const baseUrl = resolveRequestOrigin(req);
  const redirectUri = `${baseUrl}/auth/callback`;

  if (!clientId || !clientSecret) {
    return Response.json({
      configured: false,
      redirectUri,
    });
  }

  const state = signState({
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo read:user',
    state,
  });

  return Response.json({
    configured: true,
    redirectUri,
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
  });
}
