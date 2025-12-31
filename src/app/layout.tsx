import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Smart Budget Application',
  description: 'AI-powered personal finance tracker with smart insights',
  manifest: '/manifest.json',
  themeColor: '#3182CE',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Smart Budget',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
