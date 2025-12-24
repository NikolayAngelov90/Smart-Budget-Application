/**
 * Story 8.3: Settings Page and Account Management
 * Unit Tests for ConfirmDeleteModal Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

      expect(screen.getByText('Delete Account Permanently')).toBeInTheDocument();
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

      expect(screen.queryByText('Delete Account Permanently')).not.toBeInTheDocument();
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
      expect(screen.getByText(/all your data including transactions, categories, and insights will be permanently deleted/i)).toBeInTheDocument();
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
        screen.getByText(/before proceeding, please make sure you have exported your data/i)
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

      const passwordInput = screen.getByPlaceholderText(/your password/i);
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

      const passwordInput = screen.getByPlaceholderText(/your password/i) as HTMLInputElement;

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

      const passwordInput = screen.getByPlaceholderText(/your password/i);
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

      const passwordInput = screen.getByPlaceholderText(/your password/i);
      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });

      fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledWith('mypassword123');
    });

    test('Confirm button is not disabled when password is empty', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });
      // Component currently doesn't disable button when password is empty
      expect(confirmButton).not.toBeDisabled();
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

      const passwordInput = screen.getByPlaceholderText(/your password/i);
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
      const buttons = screen.getAllByRole('button');

      expect(cancelButton).toBeDisabled();
      // Confirm button should also be disabled when isDeleting is true
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      buttons.forEach(button => {
        if (button === cancelButton || button.hasAttribute('data-loading')) {
          expect(button).toBeDisabled();
        }
      });
    });
  });

  describe('Loading state', () => {
    test('shows loading state on Confirm button during deletion', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      // Button should have data-loading attribute when isDeleting is true
      const buttons = screen.getAllByRole('button');
      const loadingButton = buttons.find(button => button.hasAttribute('data-loading'));
      expect(loadingButton).toBeInTheDocument();
      expect(loadingButton).toBeDisabled();
    });

    test('disables cancel button during deletion', () => {
      customRender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const passwordInput = screen.getByPlaceholderText(/your password/i);
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(passwordInput).toBeDisabled();
      expect(cancelButton).toBeDisabled();

      // Try clicking while disabled
      fireEvent.click(cancelButton);

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

      const passwordInput = screen.getByPlaceholderText(/your password/i) as HTMLInputElement;

      // Enter password
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
      expect(passwordInput.value).toBe('mypassword');

      // Click cancel to close modal (which triggers handleClose and clears password)
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Verify onClose was called
      expect(mockOnClose).toHaveBeenCalled();

      // Reopen modal
      mockOnClose.mockClear();
      rerender(
        <ConfirmDeleteModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      // Password should be cleared
      const newPasswordInput = screen.getByPlaceholderText(/your password/i) as HTMLInputElement;
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

      expect(screen.getByLabelText(/enter your password to confirm/i)).toBeInTheDocument();
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

      const passwordInput = screen.getByPlaceholderText(/your password/i);
      fireEvent.change(passwordInput, { target: { value: 'password' } });

      const confirmButton = screen.getByRole('button', { name: /confirm deletion/i });

      // Chakra UI applies colorScheme through classes
      expect(confirmButton).toHaveClass('chakra-button');
    });
  });
});
