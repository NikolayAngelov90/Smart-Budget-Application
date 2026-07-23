import { render, screen, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { TransactionRow } from '../TransactionRow';

const category = { id: 'c1', name: 'Groceries', color: '#C4593A', type: 'expense' as const };

const renderRow = (overrides: Partial<React.ComponentProps<typeof TransactionRow>> = {}) =>
  render(
    <ChakraProvider>
      <TransactionRow
        category={category}
        type="expense"
        notes="Weekly shop"
        amountFormatted="-€42.00"
        convertedText={null}
        typeLabel="Expense"
        editLabel="Edit transaction"
        deleteLabel="Delete transaction"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        {...overrides}
      />
    </ChakraProvider>
  );

describe('TransactionRow', () => {
  it('shows the category name, note and signed amount', () => {
    renderRow();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Weekly shop')).toBeInTheDocument();
    expect(screen.getByText('-€42.00')).toBeInTheDocument();
  });

  it('names the amount with the localized type so meaning is not colour-only', () => {
    renderRow();
    expect(screen.getByLabelText('Expense -€42.00')).toBeInTheDocument();
  });

  it('shows a converted equivalent when provided', () => {
    renderRow({ convertedText: '≈ -€38.00' });
    expect(screen.getByText('≈ -€38.00')).toBeInTheDocument();
  });

  it('wires the edit and delete actions', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    renderRow({ onEdit, onDelete });
    // Desktop actions carry base display:none in jsdom — query including hidden.
    fireEvent.click(screen.getByRole('button', { name: 'Edit transaction', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete transaction', hidden: true }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
