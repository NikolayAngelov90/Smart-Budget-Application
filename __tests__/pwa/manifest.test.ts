/**
 * PWA Manifest Configuration Tests
 * Story 10-7: Enhanced PWA for Mobile Production
 * AC-10.7.11: Unit tests for manifest configuration
 */

import * as fs from 'fs';
import * as path from 'path';

describe('PWA Manifest Configuration', () => {
  let manifest: Record<string, unknown>;

  beforeAll(() => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    const content = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  });

  describe('AC-10.7.1: Required manifest fields', () => {
    it('has name field', () => {
      expect(manifest.name).toBe('Smart Budget Application');
    });

    it('has short_name field', () => {
      expect(manifest.short_name).toBe('Smart Budget');
    });

    it('has description field', () => {
      expect(manifest.description).toBeTruthy();
    });

    it('has start_url field', () => {
      expect(manifest.start_url).toBe('/');
    });

    it('has scope field', () => {
      expect(manifest.scope).toBe('/');
    });

    it('has id field', () => {
      expect(manifest.id).toBe('/');
    });

    it('has theme_color field', () => {
      expect(manifest.theme_color).toBe('#3182CE');
    });

    it('has background_color field', () => {
      expect(manifest.background_color).toBe('#ffffff');
    });

    it('has lang field', () => {
      expect(manifest.lang).toBe('en');
    });

    it('has dir field', () => {
      expect(manifest.dir).toBe('ltr');
    });
  });

  describe('AC-10.7.3: Standalone display mode', () => {
    it('display is set to standalone', () => {
      expect(manifest.display).toBe('standalone');
    });
  });

  describe('AC-10.7.1: Icon configuration', () => {
    const icons = () => manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>;

    it('has at least 4 icon entries', () => {
      expect(icons().length).toBeGreaterThanOrEqual(4);
    });

    it('has 192x192 icon with purpose "any"', () => {
      const icon = icons().find(i => i.sizes === '192x192' && i.purpose === 'any');
      expect(icon).toBeDefined();
      expect(icon!.type).toBe('image/png');
    });

    it('has 192x192 icon with purpose "maskable"', () => {
      const icon = icons().find(i => i.sizes === '192x192' && i.purpose === 'maskable');
      expect(icon).toBeDefined();
    });

    it('has 512x512 icon with purpose "any"', () => {
      const icon = icons().find(i => i.sizes === '512x512' && i.purpose === 'any');
      expect(icon).toBeDefined();
      expect(icon!.type).toBe('image/png');
    });

    it('has 512x512 icon with purpose "maskable"', () => {
      const icon = icons().find(i => i.sizes === '512x512' && i.purpose === 'maskable');
      expect(icon).toBeDefined();
    });

    it('icon files exist on disk', () => {
      const iconPaths = [...new Set(icons().map(i => i.src))];
      for (const iconSrc of iconPaths) {
        const iconPath = path.join(process.cwd(), 'public', iconSrc);
        expect(fs.existsSync(iconPath)).toBe(true);
      }
    });
  });

  describe('Shortcuts configuration', () => {
    const shortcuts = () => manifest.shortcuts as Array<{ name: string; url: string }>;

    it('has at least one shortcut', () => {
      expect(shortcuts().length).toBeGreaterThanOrEqual(1);
    });

    it('has Add Transaction shortcut', () => {
      const addShortcut = shortcuts().find(s => s.name === 'Add Transaction');
      expect(addShortcut).toBeDefined();
      expect(addShortcut!.url).toContain('add-transaction');
    });

    it('has Dashboard shortcut', () => {
      const dashShortcut = shortcuts().find(s => s.name === 'Dashboard');
      expect(dashShortcut).toBeDefined();
      expect(dashShortcut!.url).toBe('/dashboard');
    });
  });
});
