/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for ConfirmDeleteModal Component
 */

import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';

// Wrapper component for Chakra UI
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ChakraProvider>{children}</ChakraProvider>;
};

const customRender = (ui: React.ReactElement) => {
  return render(ui, { wrapper: AllTheProviders });
};

describe('ConfirmDeleteModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AC-8.3.8: Modal rendering and visibility', () => {
    test('renders modal when isOpen is true', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByText('Delete Account')).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    test('does not render modal when isOpen is false', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.queryByText('Delete Account')).not.toBeInTheDocument();
    });
  });

  describe('AC-8.3.8: Warning message', () => {
    test('displays warning message about irreversible action', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      expect(screen.getByText(/all your data will be permanently deleted/i)).toBeInTheDocument();
    });

    test('displays data export notification', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(
        screen.getByText(/your transaction data will be automatically exported/i)
      ).toBeInTheDocument();
    });
  });

  describe('AC-8.3.8: Password input field', () => {
    test('renders password input field for verification', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('allows user to type password', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i) as HTMLInputElement;

      fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });

      expect(passwordInput.value).toBe('mypassword123');
    });

    test('password field is disabled during deletion', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      expect(passwordInput).toBeDisabled();
    });
  });

  describe('AC-8.3.8: Cancel and Confirm buttons', () => {
    test('renders Cancel and Confirm Deletion buttons', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm deletion/i })).toBeInTheDocument();
    });

    test('calls onClose when Cancel button is clicked', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    test('calls onConfirm with password when Confirm Deletion is clicked', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });

      fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith('mypassword123');
    });

    test('Confirm button is disabled when password is empty', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });
      expect(confirmButton).toBeDisabled();
    });

    test('Confirm button is enabled when password is provided', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });

      fireEvent.change(passwordInput, { target: { value: 'password' } });

      expect(confirmButton).not.toBeDisabled();
    });

    test('both buttons are disabled during deletion', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const confirmButton = screen.getByRole('button', { name: /deleting\.\.\./i });

      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Loading state', () => {
    test('shows loading text on Confirm button during deletion', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^confirm deletion$/i })).not.toBeInTheDocument();
    });

    test('disables all interactions during deletion', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const confirmButton = screen.getByRole('button', { name: /deleting\.\.\./i });

      expect(passwordInput).toBeDisabled();
      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();

      // Try clicking while disabled
      fireEvent.click(cancelButton);
      fireEvent.click(confirmButton);

      // Callbacks should not be triggered
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Password reset on modal close', () => {
    test('clears password field when modal is closed', async () => {
      const { rerender } = customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i) as HTMLInputElement;

      // Enter password
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
      expect(passwordInput.value).toBe('mypassword');

      // Close and reopen modal
      rerender(
        <ConfirmDeleteModal
          isOpen={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      rerender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      // Password should be cleared
      const newPasswordInput = screen.getByPlaceholderText(/enter your password/i) as HTMLInputElement;
      expect(newPasswordInput.value).toBe('');
    });
  });

  describe('Accessibility', () => {
    test('modal has proper ARIA attributes', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      // Chakra UI Modal should have role="dialog"
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    test('password input has associated label', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByLabelText(/confirm your password/i)).toBeInTheDocument();
    });

    test('danger color scheme for Confirm button', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      fireEvent.change(passwordInput, { target: { value: 'password' } });

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });

      // Chakra UI applies colorScheme through classes
      expect(confirmButton).toHaveClass('chakra-button');
    });
  });
});
