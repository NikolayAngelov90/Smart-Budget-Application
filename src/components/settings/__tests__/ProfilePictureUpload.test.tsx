/**
 * Profile Picture Upload (Phase 2)
 * Component Tests for ProfilePictureUpload
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import * as uploadService from '@/lib/services/uploadService';
import { createClient } from '@/lib/supabase/client';

// Mock dependencies
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/services/uploadService');
jest.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: jest.fn() }),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockValidateProfilePicture = uploadService.validateProfilePicture as jest.MockedFunction<
  typeof uploadService.validateProfilePicture
>;
const mockGeneratePreviewUrl = uploadService.generatePreviewUrl as jest.MockedFunction<
  typeof uploadService.generatePreviewUrl
>;
const mockUploadProfilePicture = uploadService.uploadProfilePicture as jest.MockedFunction<
  typeof uploadService.uploadProfilePicture
>;
const mockDeleteProfilePicture = uploadService.deleteProfilePicture as jest.MockedFunction<
  typeof uploadService.deleteProfilePicture
>;

// Wrapper for Chakra UI
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ChakraProvider>{children}</ChakraProvider>;
};

const customRender = (ui: React.ReactElement) => {
  return render(ui, { wrapper: AllTheProviders });
};

describe('ProfilePictureUpload', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        }),
      },
    };

    mockCreateClient.mockReturnValue(mockSupabase);

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    test('renders avatar with current picture', () => {
      customRender(
        <ProfilePictureUpload
          currentPictureUrl="https://example.com/picture.jpg"
          displayName="Test User"
          email="test@example.com"
        />
      );

      const avatar = screen.getByRole('img');
      expect(avatar).toBeInTheDocument();
    });

    test('renders "Upload Picture" button when no current picture', () => {
      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      expect(screen.getByRole('button', { name: /upload picture/i })).toBeInTheDocument();
    });

    test('renders "Change Picture" button when picture exists', () => {
      customRender(
        <ProfilePictureUpload
          currentPictureUrl="https://example.com/picture.jpg"
          displayName="Test User"
          email="test@example.com"
        />
      );

      expect(screen.getByRole('button', { name: /change picture/i })).toBeInTheDocument();
    });

    test('renders "Remove" button when picture exists', () => {
      customRender(
        <ProfilePictureUpload
          currentPictureUrl="https://example.com/picture.jpg"
          displayName="Test User"
          email="test@example.com"
        />
      );

      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    });

    test('displays file requirements text', () => {
      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      expect(screen.getByText(/JPG, PNG, or WEBP. Max 5MB./i)).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    test('validates file on selection', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockValidateProfilePicture).toHaveBeenCalledWith(file);
        expect(mockGeneratePreviewUrl).toHaveBeenCalledWith(file);
      });
    });

    test('shows Upload and Cancel buttons after valid file selection', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });

    test('shows error toast for invalid file', async () => {
      mockValidateProfilePicture.mockReturnValue({
        valid: false,
        error: 'Invalid file type',
      });

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.gif', { type: 'image/gif' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockValidateProfilePicture).toHaveBeenCalledWith(file);
        expect(mockGeneratePreviewUrl).not.toHaveBeenCalled();
      });
    });
  });

  describe('File Upload', () => {
    test('uploads file successfully', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');
      mockUploadProfilePicture.mockResolvedValue({
        publicUrl: 'https://example.com/storage/user-123/profile.jpg',
        path: 'user-123/profile.jpg',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { profile_picture_url: 'https://example.com/storage/user-123/profile.jpg' } }),
      });

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockUploadProfilePicture).toHaveBeenCalledWith(
          file,
          'user-123',
          expect.any(Function)
        );
        expect(global.fetch).toHaveBeenCalledWith('/api/user/profile-picture', expect.any(Object));
      });
    });

    test('shows progress during upload', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let _progressCallback: ((progress: number) => void) | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUploadProfilePicture.mockImplementation(async (file: any, userId: string, onProgress?: any) => {
        _progressCallback = onProgress;
        return {
          publicUrl: 'https://example.com/storage/profile.jpg',
          path: 'user-123/profile.jpg',
        };
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/uploading\.\.\./i)).toBeInTheDocument();
      });
    });

    test('calls onUploadSuccess callback', async () => {
      const onUploadSuccess = jest.fn();

      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');
      mockUploadProfilePicture.mockResolvedValue({
        publicUrl: 'https://example.com/storage/user-123/profile.jpg',
        path: 'user-123/profile.jpg',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
          onUploadSuccess={onUploadSuccess}
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(onUploadSuccess).toHaveBeenCalledWith('https://example.com/storage/user-123/profile.jpg');
      });
    });

    test('shows error toast when upload fails', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');
      mockUploadProfilePicture.mockRejectedValue(new Error('Upload failed'));

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockUploadProfilePicture).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Action', () => {
    test('cancels file selection', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^upload$/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /upload picture/i })).toBeInTheDocument();
      });
    });
  });

  describe('Delete Action', () => {
    test('deletes current picture successfully', async () => {
      mockDeleteProfilePicture.mockResolvedValue();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      customRender(
        <ProfilePictureUpload
          currentPictureUrl="https://example.com/picture.jpg"
          displayName="Test User"
          email="test@example.com"
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockDeleteProfilePicture).toHaveBeenCalledWith('https://example.com/picture.jpg');
        expect(global.fetch).toHaveBeenCalledWith('/api/user/profile', expect.any(Object));
      });
    });

    test('shows error toast when deletion fails', async () => {
      mockDeleteProfilePicture.mockRejectedValue(new Error('Delete failed'));

      customRender(
        <ProfilePictureUpload
          currentPictureUrl="https://example.com/picture.jpg"
          displayName="Test User"
          email="test@example.com"
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockDeleteProfilePicture).toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    test('disables buttons during upload', async () => {
      mockValidateProfilePicture.mockReturnValue({ valid: true });
      mockGeneratePreviewUrl.mockResolvedValue('data:image/jpeg;base64,preview');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      let _resolveUpload: ((value: any) => void) | undefined;
      mockUploadProfilePicture.mockImplementation(
        () =>
          new Promise((resolve) => {
            _resolveUpload = resolve;
          })
      );

      customRender(
        <ProfilePictureUpload
          currentPictureUrl={null}
          displayName="Test User"
          email="test@example.com"
        />
      );

      const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/uploading\.\.\./i)).toBeInTheDocument();
      });
    });
  });
});
