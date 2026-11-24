import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANIFEST = {
  id: '/',
  name: 'CodeLab IDE | كود لاب',
  short_name: 'CodeLab',
  description:
    'بيئة تطوير متكاملة في المتصفح لكتابة وتشغيل أكواد الويب وأكثر من 44 لغة برمجة مع العمل بدون إنترنت ومزامنة GitHub.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone'],
  orientation: 'any',
  dir: 'rtl',
  lang: 'ar',
  background_color: '#0f172a',
  theme_color: '#0f172a',
  categories: ['developer', 'productivity', 'utilities'],
  icons: [
    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

export async function GET(req) {
  const q = new URL(req.url).searchParams;

  if (q.get('manifest')) {
    return new Response(JSON.stringify(MANIFEST), {
      headers: { 'Content-Type': 'application/manifest+json' },
    });
  }

  if (q.get('icon')) {
    const file = q.get('icon') === '512' ? 'pwa-512x512.png' : 'pwa-192x192.png';
    const data = await readFile(path.join(process.cwd(), 'public', file));
    return new Response(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (q.get('sw')) {
    const sw = await readFile(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');
    return new Response(sw, {
      headers: {
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  if (q.get('clean')) {
    return new Response('', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  return Response.json({ ok: true });
}
