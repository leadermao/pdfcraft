import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: '雨来 PDF 工具箱 - 专业 PDF 工具',
  description: '免费、私密、纯浏览器端的 PDF 工具箱。合并、拆分、压缩、转换、编辑 PDF，文件不上传服务器。',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

// Root layout - provides the basic HTML structure
// The actual layout with i18n is in [locale]/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light" />
        <style dangerouslySetInnerHTML={{ __html: 'html{scrollbar-gutter:stable}' }} />
        {/* Google Analytics (async; fails silently if unreachable) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-8YQPQZ26FC" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-8YQPQZ26FC');
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
