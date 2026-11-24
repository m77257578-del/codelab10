// Server-side GitHub OAuth authorization URL generator following popup-based flow

import crypto from 'node:crypto';
import { signState } from '../../../lib/serverCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAppBaseUrl(req) {
  const fromEnv = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

export async function GET(req) {
  const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
  const baseUrl = getAppBaseUrl(req);
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
