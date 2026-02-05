/**
 * Session Types
 * Story 9-6: Complete Device Session Management
 *
 * Type definitions for device session management.
 */

// Device type enum (matches database)
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Device Session
 * Represents an active user session on a specific device
 */
export interface DeviceSession {
  id: string;
  user_id: string;
  session_token: string;
  device_name: string;
  device_type: DeviceType;
  browser: string | null;
  ip_address: string | null;
  last_active: string; // ISO timestamp
  created_at: string;
}

/**
 * API request payload for updating device name
 */
export interface UpdateDeviceNamePayload {
  device_name: string;
}

/**
 * API response for session operations
 */
export interface SessionOperationResponse {
  success: boolean;
  error?: string;
  session?: DeviceSession;
}

/**
 * Props for the Active Devices section component
 */
export interface ActiveDevicesSectionProps {
  currentSessionId?: string;
}

/**
 * Props for individual device session row
 */
export interface DeviceSessionRowProps {
  session: DeviceSession;
  isCurrentSession: boolean;
  onEditName: (sessionId: string, newName: string) => Promise<void>;
  onRevoke: (sessionId: string) => void;
}

/**
 * Props for confirm revoke modal
 */
export interface ConfirmRevokeSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deviceName: string;
  isLoading?: boolean;
}
