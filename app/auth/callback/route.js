// GitHub OAuth callback route returning postMessage script to popup opener

import { encryptSession, verifyState } from '../../lib/serverCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function htmlResponse(bodyScript, status = 200) {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>ربط GitHub</title></head><body style="font-family:system-ui,sans-serif;background:#0b1120;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px;"><p>جاري إتمام الربط مع GitHub...</p><script>${bodyScript}<\/script></body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function safeJson(val) {
  return JSON.stringify(val).replace(/</g, '\\u003c');
}

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return htmlResponse(
      `if(window.opener){window.opener.postMessage(${safeJson({ type: 'GITHUB_OAUTH_ERROR', error: oauthError })},'*');window.close();}`,
      400
    );
  }

  if (!code || !state || !verifyState(state)) {
    return htmlResponse(
      `if(window.opener){window.opener.postMessage(${safeJson({ type: 'GITHUB_OAUTH_ERROR', error: 'تعذر التحقق من جلسة المصادقة (state غير صالح).' })},'*');window.close();}`,
      400
    );
  }

  const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    return htmlResponse(
      `if(window.opener){window.opener.postMessage(${safeJson({ type: 'GITHUB_OAUTH_ERROR', error: 'إعدادات GitHub OAuth غير مكتملة على الخادم.' })},'*');window.close();}`,
      500
    );
  }

  try {
    const baseUrl = (process.env.APP_URL || url.origin).trim().replace(/\/+$/, '');
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${baseUrl}/auth/callback`,
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenJson?.access_token) {
      return htmlResponse(
        `if(window.opener){window.opener.postMessage(${safeJson({ type: 'GITHUB_OAUTH_ERROR', error: tokenJson?.error_description || 'فشل الحصول على رمز الوصول من GitHub.' })},'*');window.close();}`,
        400
      );
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodeLab-IDE',
      },
    });
    const userJson = await userRes.json();
    if (!userRes.ok || !userJson?.login) {
      return htmlResponse(
        `if(window.opener){window.opener.postMessage(${safeJson({ type: 'GITHUB_OAUTH_ERROR', error: 'تعذر قراءة بيانات حساب GitHub.' })},'*');window.close();}`,
        400
      );
    }

    const sessionToken = encryptSession({
      accessToken: tokenJson.access_token,
      login: userJson.login,
      name: userJson.name || userJson.login,
      avatar_url: userJson.avatar_url || '',
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });

    const payload = {
      type: 'GITHUB_OAUTH_SUCCESS',
      sessionToken,
      user: {
        login: userJson.login,
        name: userJson.name || userJson.login,
        avatar_url: userJson.avatar_url || '',
      },
    };

    return htmlResponse(
      `if(window.opener){window.opener.postMessage(${safeJson(payload)},'*');window.close();}else{document.body.innerHTML='<p>تم الربط بنجاح. يمكنك إغلاق هذه النافذة والعودة للتطبيق.</p>';}`
    );
  } catch {
    return htmlResponse(
      `if(window.opener){window.opener.postMessage(${safeJson({ type: 'GITHUB_OAUTH_ERROR', error: 'حدث خطأ أثناء الاتصال بخدمة GitHub.' })},'*');window.close();}`,
      500
    );
  }
}
