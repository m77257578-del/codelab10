import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'CodeLab | كود لاب — محرر أكواد احترافي',
  description: 'بيئة تطوير متكاملة في المتصفح لكتابة وتشغيل أكواد الويب و38+ لغة برمجة مع العمل بدون إنترنت',
  manifest: '/api/pwa?manifest=1',
  icons: { icon: '/codelab-logo.jpg', apple: '/codelab-logo.jpg' },
  appleWebApp: { capable: true, title: 'CodeLab', statusBarStyle: 'black-translucent' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-[#0b1120] dark:text-slate-100 antialiased selection:bg-sky-500/30">
        {process.env.NODE_ENV !== 'production' && (
          <Script src="/api/pwa?clean=1" strategy="beforeInteractive" />
        )}
        {children}
      </body>
    </html>
  );
}
