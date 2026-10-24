import './globals.css';

export const metadata = {
  title: 'CodeLab | كود لاب',
  description: 'منصة تعليمية متكاملة لتعلم البرمجة',
  manifest: '/api/ai?manifest=1',
  icons: { icon: '/api/ai?icon=192', apple: '/api/ai?icon=192' },
  appleWebApp: { capable: true, title: 'CodeLab', statusBarStyle: 'black-translucent' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#6d28d9' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
