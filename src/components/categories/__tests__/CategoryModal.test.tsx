/**
 * CategoryModal — first tests for this component.
 *
 * It sat at 0% coverage while being one of only two modals in the app that go
 * full-bleed on mobile, and hp-11 changed its chrome: safe-area insets on the
 * content box, a 44px close button offset below the notch, and a header column
 * reserved for it.
 *
 * The source-level sweep (src/__tests__/modal-safe-area-sweep.test.ts) pins the
 * PROPS, because jsdom has no layout engine and cannot tell you where anything
 * rendered. These tests cover what jsdom CAN see: that the component renders in
 * both modes, that the close affordance exists and is reachable, and that
 * dismissal is wired. Between them the file stops being untested.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { CategoryModal } from '../CategoryModal';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const t: Record<string, string> = {
      addCategory: 'Add Category',
      editCategory: 'Edit Category',
      categoryName: 'Name',
      cancel: 'Cancel',
      save: 'Save',
    };
    return t[key] ?? key;
  },
}));

jest.mock('@/lib/hooks/useHousehold', () => ({
  useHousehold: () => ({ household: null, isLoading: false, error: null }),
}));

const renderModal = (props: Partial<React.ComponentProps<typeof CategoryModal>> = {}) =>
  render(
    <ChakraProvider>
      <CategoryModal isOpen onClose={jest.fn()} {...props} />
    </ChakraProvider>
  );

describe('CategoryModal', () => {
  it('renders the add-mode title when not editing', () => {
    renderModal();
    expect(screen.getByText('Add Category')).toBeInTheDocument();
  });

  it('renders the edit-mode title when editing', () => {
    renderModal({
      editMode: true,
      category: {
        id: 'cat-1',
        user_id: 'user-1',
        name: 'Dining',
        color: '#ff0000',
        icon: null,
        is_default: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } as never,
    });
    expect(screen.getByText('Edit Category')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('Add Category')).not.toBeInTheDocument();
  });

  it('exposes a close control and calls onClose when it is used', async () => {
    const onClose = jest.fn();
    renderModal({ onClose });

    // Chakra labels ModalCloseButton "Close" by default. hp-11 gave it explicit
    // 44px minimums and a safe-area offset; those are sizes jsdom cannot
    // measure, so this asserts the control is present and wired, and the sweep
    // asserts the props.
    const close = screen.getByRole('button', { name: /close/i });
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});
