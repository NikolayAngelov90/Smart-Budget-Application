/**
 * Offline Fallback Page Tests
 * Story 10-7: Enhanced PWA for Mobile Production
 * AC-10.7.7: Offline fallback page validation
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Offline Fallback Page', () => {
  let offlineHtml: string;

  beforeAll(() => {
    const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
    offlineHtml = fs.readFileSync(offlinePath, 'utf-8');
  });

  it('exists in public directory', () => {
    const offlinePath = path.join(process.cwd(), 'public', 'offline.html');
    expect(fs.existsSync(offlinePath)).toBe(true);
  });

  it('is a valid HTML document', () => {
    expect(offlineHtml).toContain('<!DOCTYPE html>');
    expect(offlineHtml).toContain('<html');
    expect(offlineHtml).toContain('</html>');
  });

  it('has proper viewport meta tag', () => {
    expect(offlineHtml).toContain('viewport');
    expect(offlineHtml).toContain('width=device-width');
  });

  it('has matching theme color', () => {
    expect(offlineHtml).toContain('#3182CE');
  });

  it('contains offline messaging', () => {
    expect(offlineHtml).toContain('Offline');
  });

  it('has a retry button', () => {
    expect(offlineHtml).toContain('Try Again');
    expect(offlineHtml).toContain('reload()');
  });

  it('handles safe area insets for mobile', () => {
    expect(offlineHtml).toContain('safe-area-inset');
  });
});
