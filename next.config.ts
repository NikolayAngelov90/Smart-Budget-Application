import type { NextConfig } from 'next';
import withPWA from 'next-pwa';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * FAIL LOUDLY. This used to fall back to '*.supabase.co' when the variable was
 * unset, which silently widened the image allowlist from ONE project host to
 * EVERY Supabase project on the internet. Next's image optimizer would then
 * fetch and re-serve third-party content under our own domain — an open-proxy
 * shape, burning the transformation quota. Narrow, because of the
 * `/storage/v1/object/public/**` path constraint, but the property that makes it
 * bad is that a security control weakened WITH NO SIGNAL.
 *
 * It was not hypothetical: the pre-deployment gate's `next build` ran with this
 * variable absent (measured — `NEXT_PUBLIC_SUPABASE var count: 0`) on every
 * deploy, and nothing said so.
 *
 * THE TRAP THIS ALSO GUARDS, for whoever optimises this pipeline next:
 * `NEXT_PUBLIC_*` values are INLINED INTO THE CLIENT BUNDLE at build time. A
 * build without them does not merely use a different config — it emits an
 * artifact whose client bundle has `undefined` where the Supabase URL should be.
 * That artifact is harmless today for exactly one reason: `vercel build --prod`
 * rebuilds afterwards and its output is what ships. Reuse the gate's output to
 * "save a build" and you ship a dead app. Throwing here makes that impossible
 * to do by accident.
 *
 * Excluded under NODE_ENV=test because `next/jest` loads this config to build
 * the Jest transform, and it does so BEFORE .env.local reaches process.env — a
 * bare throw took the whole suite down at startup. Measured, not assumed: at
 * config load Jest reports NODE_ENV=test with no URL, `next build` reports
 * NODE_ENV=production with one, and NEXT_PHASE is undefined in both, so the
 * phase constant is not usable here. The test runner never emits an image
 * allowlist or a client bundle, so it has nothing to get wrong.
 */
if (process.env.NODE_ENV !== 'test' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL is not set. Refusing to build: the image ' +
      'remotePatterns allowlist would silently widen to every *.supabase.co ' +
      'host, and NEXT_PUBLIC_* values are inlined into the client bundle, so ' +
      'this build would also ship an app that cannot reach Supabase.'
  );
}

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  // Only reachable under NODE_ENV=test, where remotePatterns is never used.
  : 'localhost';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

// Configure PWA with next-pwa plugin
// Disable in development to avoid caching issues during development
export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  customWorkerDir: 'worker',
  // Next's App Router emits app-build-manifest.json under .next/ but does NOT serve it at
  // /_next/app-build-manifest.json. If it's left in the precache manifest, the service
  // worker's install fetches it, gets a 404, and install fails — so the worker never
  // activates and push subscription hangs. Exclude it (plus other non-served manifests).
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-audio-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\.(?:mp4)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-video-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 5 * 60, // 5 minutes - keep short for realtime-sensitive data
        },
        networkTimeoutSeconds: 10, // Fall back to cache if network takes longer than 10s
      },
    },
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})(withNextIntl(nextConfig));
