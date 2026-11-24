import './globals.css';

export const metadata = {
  title: 'CodeLab | كود لاب — محرر أكواد احترافي',
  description:
    'بيئة تطوير متكاملة في المتصفح لكتابة وتشغيل أكواد الويب و44+ لغة برمجة مع العمل بدون إنترنت ومزامنة GitHub.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'CodeLab',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="bg-white text-[#1e1e1e] dark:bg-[#1e1e1e] dark:text-[#cccccc] antialiased selection:bg-[#007acc]/30">
        {children}
      </body>
    </html>
  );
}
