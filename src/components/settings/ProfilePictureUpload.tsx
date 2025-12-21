/**
 * Profile Picture Upload (Phase 2)
 * UI Component for uploading and managing profile pictures
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Avatar,
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Progress,
  useToast,
} from '@chakra-ui/react';
import { createClient } from '@/lib/supabase/client';
import {
  validateProfilePicture,
  uploadProfilePicture,
  generatePreviewUrl,
  deleteProfilePicture,
} from '@/lib/services/uploadService';
import { useSWRConfig } from 'swr';

interface ProfilePictureUploadProps {
  currentPictureUrl: string | null;
  displayName: string | null;
  email: string;
  onUploadSuccess?: (newUrl: string) => void;
}

export function ProfilePictureUpload({
  currentPictureUrl,
  displayName,
  email,
  onUploadSuccess,
}: ProfilePictureUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { mutate } = useSWRConfig();

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /**
   * Handle file selection
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file
    const validation = validateProfilePicture(file);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Generate preview
    try {
      const preview = await generatePreviewUrl(file);
      setSelectedFile(file);
      setPreviewUrl(preview);
    } catch {
      toast({
        title: 'Preview failed',
        description: 'Could not generate file preview',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Upload selected file to Supabase Storage and update profile
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Get current user
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Upload to Supabase Storage
      const uploadResult = await uploadProfilePicture(
        selectedFile,
        user.id,
        (progress) => {
          setUploadProgress(progress.percentage);
        }
      );

      // Update profile via API
      const response = await fetch('/api/user/profile-picture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_picture_url: uploadResult.publicUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      await response.json();

      // Refresh profile data
      mutate('/api/user/profile');

      // Show success toast
      toast({
        title: 'Profile picture updated',
        description: 'Your profile picture has been successfully updated.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset state
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Callback
      if (onUploadSuccess) {
        onUploadSuccess(uploadResult.publicUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);

      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload profile picture',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Cancel file selection
   */
  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Delete current profile picture
   */
  const handleDelete = async () => {
    if (!currentPictureUrl) {
      return;
    }

    setIsDeleting(true);

    try {
      // Delete from storage
      await deleteProfilePicture(currentPictureUrl);

      // Update profile to remove picture URL
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_picture_url: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Refresh profile data
      mutate('/api/user/profile');

      toast({
        title: 'Profile picture removed',
        description: 'Your profile picture has been removed.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Delete error:', error);

      toast({
        title: 'Delete failed',
        description: 'Failed to remove profile picture',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Trigger file input click
   */
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const displayPictureUrl = previewUrl || currentPictureUrl;
  const showUploadActions = selectedFile !== null;

  return (
    <VStack spacing={4} align="center">
      {/* Avatar Preview */}
      <Box position="relative">
        <Avatar
          size="2xl"
          name={displayName || email}
          src={displayPictureUrl || undefined}
          bg="brand.500"
        />
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Upload Progress */}
      {isUploading && (
        <Box width="100%">
          <Progress
            value={uploadProgress}
            size="sm"
            colorScheme="brand"
            borderRadius="md"
          />
          <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
            Uploading... {uploadProgress}%
          </Text>
        </Box>
      )}

      {/* Action Buttons */}
      {!showUploadActions && !isUploading && (
        <HStack spacing={3}>
          <Button
            size="sm"
            colorScheme="brand"
            onClick={triggerFileInput}
          >
            {currentPictureUrl ? 'Change Picture' : 'Upload Picture'}
          </Button>

          {currentPictureUrl && (
            <Button
              size="sm"
              variant="outline"
              colorScheme="red"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Remove
            </Button>
          )}
        </HStack>
      )}

      {/* Upload/Cancel Actions (shown after file selection) */}
      {showUploadActions && !isUploading && (
        <HStack spacing={3}>
          <Button
            size="sm"
            colorScheme="brand"
            onClick={handleUpload}
          >
            Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </HStack>
      )}

      {/* File requirements */}
      <Text fontSize="xs" color="gray.500" textAlign="center">
        JPG, PNG, or WEBP. Max 5MB.
      </Text>
    </VStack>
  );
}
