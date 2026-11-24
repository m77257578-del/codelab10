// Server-side GitHub repository creator & incremental multi-file atomic Git Data API pusher

import { decryptSession } from '../../../lib/serverCrypto';
import { executeGitHubPush } from '../../../lib/githubPushService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const sessionToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const session = decryptSession(sessionToken);

    let body = null;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'بيانات الطلب غير صالحة أو حجم الملفات يتجاوز الحد المسموح.' },
        { status: 400 }
      );
    }

    const result = await executeGitHubPush({ session, body });
    return Response.json(result.payload, { status: result.status });
  } catch (err) {
    return Response.json(
      { error: err?.message || 'حدث خطأ أثناء الرفع إلى GitHub.' },
      { status: 500 }
    );
  }
}
