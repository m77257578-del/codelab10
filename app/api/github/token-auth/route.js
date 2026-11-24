// Server-side endpoint to authenticate GitHub using a Personal Access Token (PAT)

import { encryptSession } from '../../../lib/serverCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    if (!token) {
      return Response.json({ error: 'يرجى إدخال رمز الوصول الشخصي (Personal Access Token).' }, { status: 400 });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodeLab-IDE',
      },
    });

    const userJson = await userRes.json().catch(() => ({}));
    if (!userRes.ok || !userJson?.login) {
      return Response.json(
        { error: userJson?.message || 'رمز الوصول الشخصي (PAT) غير صالح أو صلاحيات repo غير مفقودة.' },
        { status: 401 }
      );
    }

    const sessionToken = encryptSession({
      accessToken: token,
      login: userJson.login,
      name: userJson.name || userJson.login,
      avatar_url: userJson.avatar_url || '',
      exp: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
    });

    return Response.json({
      ok: true,
      sessionToken,
      user: {
        login: userJson.login,
        name: userJson.name || userJson.login,
        avatar_url: userJson.avatar_url || '',
      },
    });
  } catch (err) {
    return Response.json({ error: err?.message || 'تعذر التحقق من رمز الوصول الشخصي.' }, { status: 500 });
  }
}
