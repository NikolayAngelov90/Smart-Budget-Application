/**
 * Type declarations for next-pwa
 * Since @types/next-pwa doesn't exist, we declare the module types here
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'next-pwa' {
  import { NextConfig } from 'next';

  interface PWAConfig {
    dest: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    runtimeCaching?: RuntimeCachingEntry[];
    [key: string]: any;
  }

  interface RuntimeCachingEntry {
    urlPattern: RegExp | string;
    handler: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    options?: {
      cacheName?: string;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
      };
      networkTimeoutSeconds?: number;
      rangeRequests?: boolean;
      [key: string]: any;
    };
  }

  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;

  export default withPWA;
}
