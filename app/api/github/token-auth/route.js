// Server-side endpoint to authenticate GitHub using a Personal Access Token (PAT)

import { encryptSession } from '../../../lib/serverCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const locale = body?.locale === 'en' ? 'en' : 'ar';
    const isEn = locale === 'en';
    const token = String(body?.token || '').trim();
    if (!token) {
      return Response.json(
        {
          error: isEn
            ? 'Please enter a GitHub Personal Access Token.'
            : 'يرجى إدخال رمز الوصول الشخصي (Personal Access Token).',
        },
        { status: 400 }
      );
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodeLab-IDE',
      },
      cache: 'no-store',
    });

    const userJson = await userRes.json().catch(() => ({}));
    if (!userRes.ok || !userJson?.login) {
      return Response.json(
        {
          error:
            userJson?.message ||
            (isEn
              ? 'Invalid or expired Personal Access Token.'
              : 'رمز الوصول الشخصي (PAT) غير صالح أو منتهي الصلاحية.'),
        },
        { status: 401 }
      );
    }

    // Classic PATs include x-oauth-scopes; warn early if required repo write scope is missing
    const scopesHeader = userRes.headers.get('x-oauth-scopes');
    if (scopesHeader !== null) {
      const scopes = scopesHeader
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const hasRepoWrite = scopes.includes('repo') || scopes.includes('public_repo');
      if (!hasRepoWrite) {
        return Response.json(
          {
            error: isEn
              ? 'This Personal Access Token is missing the "repo" scope required to create repositories and push files.'
              : 'رمز الوصول الشخصي لا يحتوي على صلاحية "repo" المطلوبة لإنشاء المستودعات ورفع الملفات. فعّل خيار repo عند إنشاء الرمز.',
          },
          { status: 403 }
        );
      }
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
    return Response.json(
      { error: err?.message || 'تعذر التحقق من رمز الوصول الشخصي.' },
      { status: 500 }
    );
  }
}
