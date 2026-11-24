import { getPreviewSnapshot, injectBaseHref, sanitizePreviewId } from '../../lib/previewServerStore';
import { buildWebPreviewDoc } from '../../lib/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildRecoveryHtml(id) {
  const safeId = JSON.stringify(id);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeLab Local Preview — ${id}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; padding: 24px; }
    .box { max-width: 440px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 22px; text-align: center; }
    h1 { margin: 0 0 8px; font-size: 16px; color: #38bdf8; }
    p { margin: 0 0 14px; font-size: 13px; color: #94a3b8; line-height: 1.6; }
    a { display: inline-block; padding: 8px 16px; border-radius: 8px; background: #0ea5e9; color: #082f49; text-decoration: none; font-weight: 700; font-size: 13px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>جاري مزامنة المعاينة المحلية...</h1>
    <p id="msg">يتم الآن تحميل أحدث ملفات المشروع من المحرر.</p>
    <a href="/">العودة إلى محرر CodeLab</a>
  </div>
  <script>
    (function () {
      var id = ${safeId};
      var tries = 0;
      try {
        var ch = new BroadcastChannel('codelab-preview-sync');
        ch.postMessage({ type: 'request-sync', id: id });
        ch.onmessage = function (ev) {
          if (ev.data && ev.data.type === 'synced' && ev.data.id === id) {
            window.location.reload();
          }
        };
      } catch {}
      var timer = setInterval(function () {
        tries += 1;
        fetch('/api/preview?id=' + encodeURIComponent(id), { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.exists) {
              clearInterval(timer);
              window.location.reload();
            } else if (tries >= 12) {
              clearInterval(timer);
              var el = document.getElementById('msg');
              if (el) el.textContent = 'افتح تبويب المحرر ثم اضغط تشغيل أو حدّث هذه الصفحة.';
            }
          })
          .catch(function () {});
      }, 400);
    })();
  </script>
</body>
</html>`;
}

export async function GET(_req, context) {
  const params = await context.params;
  const id = sanitizePreviewId(params?.id || '');
  const snap = getPreviewSnapshot(id);

  if (!snap) {
    return new Response(buildRecoveryHtml(id), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const rawHtml =
    snap.html && snap.html.trim()
      ? snap.html
      : buildWebPreviewDoc(snap.files || {}, snap.activeFile || '', false, snap.locale || 'ar', {
          baseHref: `/preview/${id}/`,
        });

  const html = injectBaseHref(rawHtml, `/preview/${id}/`);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
