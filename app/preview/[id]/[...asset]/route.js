import { getPreviewSnapshot, resolveSnapshotAsset, sanitizePreviewId } from '../../../lib/previewServerStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req, context) {
  const params = await context.params;
  const id = sanitizePreviewId(params?.id || '');
  const assetParts = Array.isArray(params?.asset) ? params.asset : [];
  const snap = getPreviewSnapshot(id);

  if (!snap) {
    return new Response('Preview session not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const resolved = resolveSnapshotAsset(snap, assetParts.join('/'));
  if (!resolved) {
    return new Response('Asset not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response(resolved.body, {
    status: 200,
    headers: {
      'Content-Type': resolved.contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
