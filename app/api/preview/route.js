import { NextResponse } from 'next/server';
import { getPreviewSnapshot, sanitizePreviewId, savePreviewSnapshot } from '../../lib/previewServerStore';
import { buildWebPreviewDoc } from '../../lib/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const id = sanitizePreviewId(new URL(req.url).searchParams.get('id') || '');
  const snap = getPreviewSnapshot(id);
  return NextResponse.json({
    ok: true,
    id,
    exists: Boolean(snap),
    updatedAt: snap?.updatedAt || null,
    url: `/preview/${id}`,
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const id = sanitizePreviewId(body?.id || body?.projectName || 'codelab-live');
    const files = body?.files && typeof body.files === 'object' ? body.files : {};
    const activeFile = typeof body?.activeFile === 'string' ? body.activeFile : '';
    const locale = body?.locale === 'en' ? 'en' : 'ar';
    const html =
      typeof body?.html === 'string' && body.html.trim()
        ? body.html
        : buildWebPreviewDoc(files, activeFile, false, locale, {
            baseHref: `/preview/${id}/`,
            execResult: body?.execResult || null,
          });

    const snap = savePreviewSnapshot(id, {
      html,
      files,
      activeFile,
      projectName: body?.projectName || 'my-codelab-project',
      locale,
    });

    return NextResponse.json({
      ok: true,
      id: snap.id,
      url: `/preview/${snap.id}`,
      updatedAt: snap.updatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to save preview snapshot' },
      { status: 400 }
    );
  }
}
