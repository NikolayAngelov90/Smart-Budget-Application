/**
 * Profile Picture Upload (Phase 2)
 * Upload Service - File validation, upload, delete, and preview functions
 */

import { createClient } from '@/lib/supabase/client';

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const BUCKET_NAME = 'profile-pictures';

// Types
export interface UploadValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Validates a file for profile picture upload
 * Checks file type, extension, and size
 */
export function validateProfilePicture(file: File): UploadValidationResult {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  return { valid: true };
}

/**
 * Generates a preview URL for a file (data URL)
 * Used to show preview before upload
 */
export async function generatePreviewUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a profile picture to Supabase Storage
 * File is stored in user-specific folder: {userId}/profile-picture-{timestamp}.{ext}
 */
export async function uploadProfilePicture(
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Validate file first
  const validation = validateProfilePicture(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create Supabase client
  const supabase = createClient();

  // Generate unique filename
  const timestamp = Date.now();
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const fileName = `profile-picture-${timestamp}${extension}`;
  const filePath = `${userId}/${fileName}`;

  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('Upload failed: No data returned');
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  // Simulate progress for user feedback
  if (onProgress) {
    onProgress({ loaded: file.size, total: file.size, percentage: 100 });
  }

  return {
    publicUrl,
    path: filePath,
  };
}

/**
 * Deletes a profile picture from Supabase Storage
 * Extracts file path from public URL and deletes from storage
 */
export async function deleteProfilePicture(fileUrl: string): Promise<void> {
  if (!fileUrl) {
    return; // Nothing to delete
  }

  // Extract file path from public URL
  // URL format: https://{project}.supabase.co/storage/v1/object/public/profile-pictures/{userId}/profile-picture-{timestamp}.{ext}
  const bucketPath = `storage/v1/object/public/${BUCKET_NAME}/`;
  const pathIndex = fileUrl.indexOf(bucketPath);

  if (pathIndex === -1) {
    console.warn('Invalid profile picture URL format, skipping deletion');
    return;
  }

  const filePath = fileUrl.substring(pathIndex + bucketPath.length);

  // Create Supabase client
  const supabase = createClient();

  // Delete file from storage
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    console.error('Failed to delete old profile picture:', error);
    // Don't throw error - this is a non-blocking operation
    // If deletion fails, old file remains in storage but won't be used
  }
}

/**
 * Validates that a URL is from Supabase Storage
 * Used by API endpoint to ensure URLs are legitimate
 */
export function isValidSupabaseStorageUrl(url: string, projectUrl: string): boolean {
  if (!url) {
    return false;
  }

  // URL should start with project URL and contain storage path
  const expectedPath = `/storage/v1/object/public/${BUCKET_NAME}/`;
  return url.startsWith(projectUrl) && url.includes(expectedPath);
}
