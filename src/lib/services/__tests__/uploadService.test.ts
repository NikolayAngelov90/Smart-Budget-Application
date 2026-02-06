/**
 * Profile Picture Upload (Phase 2)
 * Unit Tests for uploadService
 */

import {
  validateProfilePicture,
  generatePreviewUrl,
  uploadProfilePicture,
  deleteProfilePicture,
  isValidSupabaseStorageUrl,
} from '@/lib/services/uploadService';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('uploadService', () => {
  describe('validateProfilePicture', () => {
    test('validates valid JPEG file', () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('validates valid PNG file', () => {
      const file = new File(['content'], 'profile.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 }); // 2MB

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(true);
    });

    test('validates valid WEBP file', () => {
      const file = new File(['content'], 'profile.webp', { type: 'image/webp' });
      Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 }); // 3MB

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(true);
    });

    test('rejects file with invalid MIME type', () => {
      const file = new File(['content'], 'profile.gif', { type: 'image/gif' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('rejects file with invalid extension', () => {
      const file = new File(['content'], 'profile.bmp', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file extension');
    });

    test('rejects file exceeding size limit', () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }); // 6MB

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('File size exceeds 5MB limit');
    });

    test('rejects null file', () => {
      const result = validateProfilePicture(null as unknown as File);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    test('validates file exactly at size limit', () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }); // Exactly 5MB

      const result = validateProfilePicture(file);

      expect(result.valid).toBe(true);
    });
  });

  describe('generatePreviewUrl', () => {
    test('generates data URL for valid file', async () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });

      // Mock FileReader
      const mockReadAsDataURL = jest.fn();
      const mockFileReader = {
        readAsDataURL: mockReadAsDataURL,
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        onerror: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,mockBase64Data',
      };

      global.FileReader = jest.fn(() => mockFileReader) as unknown as typeof FileReader;

      const previewPromise = generatePreviewUrl(file);

      // Trigger onload
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader as unknown as FileReader, { target: { result: 'data:image/jpeg;base64,mockBase64Data' } } as ProgressEvent<FileReader>);
      }

      const preview = await previewPromise;

      expect(preview).toBe('data:image/jpeg;base64,mockBase64Data');
      expect(mockReadAsDataURL).toHaveBeenCalledWith(file);
    });

    test('rejects on FileReader error', async () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });

      const mockReadAsDataURL = jest.fn();
      const mockFileReader = {
        readAsDataURL: mockReadAsDataURL,
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        onerror: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
      };

      global.FileReader = jest.fn(() => mockFileReader) as unknown as typeof FileReader;

      const previewPromise = generatePreviewUrl(file);

      // Trigger onerror
      if (mockFileReader.onerror) {
        mockFileReader.onerror.call(mockFileReader as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }

      await expect(previewPromise).rejects.toThrow('Failed to read file');
    });
  });

  describe('uploadProfilePicture', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockSupabase: any;

    beforeEach(() => {
      jest.clearAllMocks();

      mockSupabase = {
        auth: {
          getUser: jest.fn(),
        },
        storage: {
          from: jest.fn(),
        },
      };

      mockCreateClient.mockReturnValue(mockSupabase);
    });

    test('uploads valid file successfully', async () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const userId = 'user-123';
      const mockPath = `${userId}/profile-picture-${Date.now()}.jpg`;

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: mockPath },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: `https://example.com/storage/${mockPath}` },
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      const result = await uploadProfilePicture(file, userId);

      expect(result.publicUrl).toContain('https://example.com/storage/');
      expect(result.path).toContain(userId);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('profile-pictures');
      expect(mockUpload).toHaveBeenCalled();
    });

    test('calls onProgress callback during upload', async () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const userId = 'user-123';
      const onProgress = jest.fn();

      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      });

      const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/storage/test' },
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      await uploadProfilePicture(file, userId, onProgress);

      expect(onProgress).toHaveBeenCalledWith({
        loaded: file.size,
        total: file.size,
        percentage: 100,
      });
    });

    test('throws error when file validation fails', async () => {
      const file = new File(['content'], 'profile.gif', { type: 'image/gif' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const userId = 'user-123';

      await expect(uploadProfilePicture(file, userId)).rejects.toThrow('Invalid file type');
    });

    test('throws error when upload fails', async () => {
      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 });

      const userId = 'user-123';

      const mockUpload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });

      mockSupabase.storage.from.mockReturnValue({
        upload: mockUpload,
      });

      await expect(uploadProfilePicture(file, userId)).rejects.toThrow('Upload failed: Storage error');
    });
  });

  describe('deleteProfilePicture', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockSupabase: any;

    beforeEach(() => {
      jest.clearAllMocks();

      mockSupabase = {
        storage: {
          from: jest.fn(),
        },
      };

      mockCreateClient.mockReturnValue(mockSupabase);
    });

    test('deletes file successfully', async () => {
      const fileUrl =
        'https://example.supabase.co/storage/v1/object/public/profile-pictures/user-123/profile-picture-123.jpg';

      const mockRemove = jest.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.storage.from.mockReturnValue({
        remove: mockRemove,
      });

      await deleteProfilePicture(fileUrl);

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('profile-pictures');
      expect(mockRemove).toHaveBeenCalledWith(['user-123/profile-picture-123.jpg']);
    });

    test('handles empty URL gracefully', async () => {
      await expect(deleteProfilePicture('')).resolves.not.toThrow();
    });

    test('handles null URL gracefully', async () => {
      await expect(deleteProfilePicture(null as unknown as string)).resolves.not.toThrow();
    });

    test('handles invalid URL format gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await deleteProfilePicture('https://invalid-url.com/image.jpg');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid profile picture URL format, skipping deletion'
      );

      consoleWarnSpy.mockRestore();
    });

    test('logs error but does not throw when deletion fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const fileUrl =
        'https://example.supabase.co/storage/v1/object/public/profile-pictures/user-123/profile-picture-123.jpg';

      const mockRemove = jest.fn().mockResolvedValue({
        error: { message: 'Deletion failed' },
      });

      mockSupabase.storage.from.mockReturnValue({
        remove: mockRemove,
      });

      await expect(deleteProfilePicture(fileUrl)).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('isValidSupabaseStorageUrl', () => {
    const projectUrl = 'https://example.supabase.co';

    test('validates correct Supabase Storage URL', () => {
      const url = `${projectUrl}/storage/v1/object/public/profile-pictures/user-123/profile.jpg`;

      const result = isValidSupabaseStorageUrl(url, projectUrl);

      expect(result).toBe(true);
    });

    test('rejects URL from different domain', () => {
      const url = 'https://other-domain.com/storage/v1/object/public/profile-pictures/user-123/profile.jpg';

      const result = isValidSupabaseStorageUrl(url, projectUrl);

      expect(result).toBe(false);
    });

    test('rejects URL from different bucket', () => {
      const url = `${projectUrl}/storage/v1/object/public/other-bucket/user-123/profile.jpg`;

      const result = isValidSupabaseStorageUrl(url, projectUrl);

      expect(result).toBe(false);
    });

    test('rejects empty URL', () => {
      const result = isValidSupabaseStorageUrl('', projectUrl);

      expect(result).toBe(false);
    });

    test('rejects null URL', () => {
      const result = isValidSupabaseStorageUrl(null as unknown as string, projectUrl);

      expect(result).toBe(false);
    });

    test('rejects URL without storage path', () => {
      const url = `${projectUrl}/some-other-path/profile.jpg`;

      const result = isValidSupabaseStorageUrl(url, projectUrl);

      expect(result).toBe(false);
    });
  });
});
