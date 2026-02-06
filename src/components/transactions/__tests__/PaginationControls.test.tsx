/**
 * PaginationControls Unit Tests
 * Story 9-7: Complete Story 6-3 Pagination UI (AC-9.7.8)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import {
  PaginationControls,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  LOCAL_STORAGE_KEY,
} from '@/components/transactions/PaginationControls';
import type { PaginationControlsProps } from '@/components/transactions/PaginationControls';

// Wrap with ChakraProvider for tests
const renderWithChakra = (props: PaginationControlsProps) => {
  return render(
    <ChakraProvider>
      <PaginationControls {...props} />
    </ChakraProvider>
  );
};

const defaultProps: PaginationControlsProps = {
  currentPage: 1,
  totalItems: 237,
  pageSize: 25,
  onPageChange: jest.fn(),
  onPageSizeChange: jest.fn(),
  isLoading: false,
};

describe('PaginationControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders pagination controls', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('does not render pagination when totalItems is 0', () => {
      renderWithChakra({ ...defaultProps, totalItems: 0 });
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('displays item count summary', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByText('Showing 1-25 of 237 transactions')).toBeInTheDocument();
    });

    it('displays correct item range on page 2', () => {
      renderWithChakra({ ...defaultProps, currentPage: 2 });
      expect(screen.getByText('Showing 26-50 of 237 transactions')).toBeInTheDocument();
    });

    it('displays correct item range on last page with partial data', () => {
      // 237 items / 25 per page = 10 pages, last page has 12 items
      renderWithChakra({ ...defaultProps, currentPage: 10 });
      expect(screen.getByText('Showing 226-237 of 237 transactions')).toBeInTheDocument();
    });
  });

  describe('AC-9.7.1: Page Size Selector', () => {
    it('renders page size selector with correct options', () => {
      renderWithChakra(defaultProps);
      const select = screen.getByLabelText('Items per page');
      expect(select).toBeInTheDocument();

      PAGE_SIZE_OPTIONS.forEach((size) => {
        expect(screen.getByRole('option', { name: size.toString() })).toBeInTheDocument();
      });
    });

    it('shows the current page size as selected', () => {
      renderWithChakra({ ...defaultProps, pageSize: 50 });
      const select = screen.getByLabelText('Items per page') as HTMLSelectElement;
      expect(select.value).toBe('50');
    });

    it('calls onPageSizeChange when page size is changed', () => {
      const onPageSizeChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageSizeChange });

      const select = screen.getByLabelText('Items per page');
      fireEvent.change(select, { target: { value: '50' } });

      expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });

    it('is disabled when loading', () => {
      renderWithChakra({ ...defaultProps, isLoading: true });
      const select = screen.getByLabelText('Items per page');
      expect(select).toBeDisabled();
    });
  });

  describe('AC-9.7.2: Jump to Page Input', () => {
    it('renders jump to page input when totalPages > 1', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByLabelText('Jump to page number')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to page')).toBeInTheDocument();
    });

    it('does not render jump to page when only 1 page', () => {
      renderWithChakra({ ...defaultProps, totalItems: 10, pageSize: 25 });
      expect(screen.queryByLabelText('Jump to page number')).not.toBeInTheDocument();
    });

    it('navigates to valid page on Enter', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it('navigates to valid page on Go button click', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '3' } });

      const goButton = screen.getByLabelText('Go to page');
      fireEvent.click(goButton);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('clears input after successful navigation', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      const input = screen.getByLabelText('Jump to page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '3' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input.value).toBe('');
    });
  });

  describe('AC-9.7.4: Dynamic Total Page Count', () => {
    it('calculates correct total pages (237 items / 25 per page = 10)', () => {
      renderWithChakra(defaultProps);
      // Page 10 button exists (may be hidden on mobile via CSS but still in DOM)
      const pageButton = screen.getByLabelText('Go to page 10');
      expect(pageButton).toBeInTheDocument();
    });

    it('recalculates when page size changes to 10 (237 / 10 = 24 pages)', () => {
      renderWithChakra({ ...defaultProps, pageSize: 10 });
      const pageButton = screen.getByLabelText('Go to page 24');
      expect(pageButton).toBeInTheDocument();
    });

    it('recalculates when page size changes to 100 (237 / 100 = 3 pages)', () => {
      renderWithChakra({ ...defaultProps, pageSize: 100 });
      const pageButton = screen.getByLabelText('Go to page 3');
      expect(pageButton).toBeInTheDocument();
    });

    it('shows 1 page when items fit in a single page', () => {
      renderWithChakra({ ...defaultProps, totalItems: 5, pageSize: 25 });
      // Should show "Showing 1-5 of 5 transactions"
      expect(screen.getByText('Showing 1-5 of 5 transactions')).toBeInTheDocument();
    });
  });

  describe('AC-9.7.6: Validation and Error Handling', () => {
    it('shows error for non-numeric input', () => {
      renderWithChakra(defaultProps);

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Enter a valid page number')).toBeInTheDocument();
    });

    it('shows error for page number below 1', () => {
      renderWithChakra(defaultProps);

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText(/Page must be between 1 and/)).toBeInTheDocument();
    });

    it('shows error for page number above max', () => {
      renderWithChakra(defaultProps); // 237 / 25 = 10 pages

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '11' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Page must be between 1 and 10')).toBeInTheDocument();
    });

    it('shows error for negative numbers', () => {
      renderWithChakra(defaultProps);

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '-1' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText(/Page must be between 1 and/)).toBeInTheDocument();
    });

    it('shows error for decimal numbers', () => {
      renderWithChakra(defaultProps);

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '3.5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Enter a valid page number')).toBeInTheDocument();
    });

    it('does not navigate on invalid input', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('clears error when user types new value', () => {
      renderWithChakra(defaultProps);

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('Enter a valid page number')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '5' } });
      expect(screen.queryByText('Enter a valid page number')).not.toBeInTheDocument();
    });

    it('does nothing when input is empty', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('AC-9.7.7: Accessibility', () => {
    it('has correct ARIA labels on navigation buttons', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
    });

    it('has correct ARIA labels on page number buttons', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByLabelText('Go to page 1')).toBeInTheDocument();
    });

    it('marks current page with aria-current', () => {
      renderWithChakra(defaultProps);
      const currentButton = screen.getByLabelText('Go to page 1');
      expect(currentButton).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark non-current pages with aria-current', () => {
      renderWithChakra(defaultProps);
      const button2 = screen.getByLabelText('Go to page 2');
      expect(button2).not.toHaveAttribute('aria-current');
    });

    it('has aria-label on page size select', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByLabelText('Items per page')).toBeInTheDocument();
    });

    it('has aria-label on jump to page input', () => {
      renderWithChakra(defaultProps);
      expect(screen.getByLabelText('Jump to page number')).toBeInTheDocument();
    });

    it('has aria-live region for page changes', () => {
      renderWithChakra(defaultProps);
      const summary = screen.getByText(/Showing .+ of .+ transactions/);
      expect(summary).toHaveAttribute('aria-live', 'polite');
    });

    it('supports Enter key on jump-to-page input', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      const input = screen.getByLabelText('Jump to page number');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onPageChange).toHaveBeenCalledWith(5);
    });
  });

  describe('Page Navigation', () => {
    it('calls onPageChange when clicking previous', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, currentPage: 2, onPageChange });

      fireEvent.click(screen.getByLabelText('Go to previous page'));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('calls onPageChange when clicking next', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      fireEvent.click(screen.getByLabelText('Go to next page'));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('disables previous button on page 1', () => {
      renderWithChakra({ ...defaultProps, currentPage: 1 });
      expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    });

    it('disables next button on last page', () => {
      renderWithChakra({ ...defaultProps, currentPage: 10 }); // 237/25 = 10
      expect(screen.getByLabelText('Go to next page')).toBeDisabled();
    });

    it('calls onPageChange when clicking a page number', () => {
      const onPageChange = jest.fn();
      renderWithChakra({ ...defaultProps, onPageChange });

      // With 10 pages and currentPage=1, visible page buttons are: 1, 2, ..., 10
      const page2Button = screen.getByLabelText('Go to page 2');
      fireEvent.click(page2Button);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('disables all controls when loading', () => {
      renderWithChakra({ ...defaultProps, isLoading: true });
      expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
      expect(screen.getByLabelText('Go to next page')).toBeDisabled();
      expect(screen.getByLabelText('Items per page')).toBeDisabled();
    });
  });

  describe('Page Number Generation', () => {
    it('shows all pages when totalPages <= 7', () => {
      renderWithChakra({ ...defaultProps, totalItems: 150, pageSize: 25 }); // 6 pages
      for (let i = 1; i <= 6; i++) {
        expect(screen.getByLabelText(`Go to page ${i}`)).toBeInTheDocument();
      }
    });

    it('shows ellipsis for many pages', () => {
      renderWithChakra({ ...defaultProps, totalItems: 500, pageSize: 10, currentPage: 5 }); // 50 pages
      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it('always shows first and last page', () => {
      renderWithChakra({ ...defaultProps, totalItems: 500, pageSize: 10, currentPage: 25 }); // 50 pages
      expect(screen.getByLabelText('Go to page 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to page 50')).toBeInTheDocument();
    });
  });

  describe('Constants', () => {
    it('exports correct PAGE_SIZE_OPTIONS', () => {
      expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
    });

    it('exports correct DEFAULT_PAGE_SIZE', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(25);
    });

    it('exports correct LOCAL_STORAGE_KEY', () => {
      expect(LOCAL_STORAGE_KEY).toBe('transactions_page_size');
    });
  });
});
