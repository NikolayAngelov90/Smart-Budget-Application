import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Space_Grotesk, Onest } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';

/**
 * Quiet Ledger type system (redesign).
 * Space Grotesk — the "display" voice: headings and, above all, financial
 * amounts. It has confident, precise, tabular-friendly figures that make money
 * read like something you can trust. (Latin only; Cyrillic headings fall back to
 * Onest via the font stack in the Chakra theme — numerals are locale-neutral.)
 * Onest — the calm, highly legible UI/body face; ships Latin + Cyrillic so the
 * Bulgarian locale stays first-class.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-onest',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom intentionally allowed (WCAG 1.4.4 resize) — Story UX-1.
  viewportFit: 'cover',
  // Quiet Ledger: the browser chrome matches the warm-paper canvas (was bank-blue).
  themeColor: '#F6F5F2',
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
    <html lang={locale} className={`${spaceGrotesk.variable} ${onest.variable}`}>
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
