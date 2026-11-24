export default function manifest() {
  return {
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
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
