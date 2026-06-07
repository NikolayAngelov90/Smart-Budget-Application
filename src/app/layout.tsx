import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from './providers';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom intentionally allowed (WCAG 1.4.4 resize) — Story UX-1.
  viewportFit: 'cover',
  themeColor: '#3182CE',
};

export const metadata: Metadata = {
  title: 'Smart Budget Application',
  description: 'AI-powered personal finance tracker with smart insights',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Smart Budget',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <ServiceWorkerRegistrar />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
