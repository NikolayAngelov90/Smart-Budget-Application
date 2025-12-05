'use client';

import { useState, useEffect } from 'react';
import {
  Stack,
  Select,
  Input,
  FormControl,
  FormLabel,
  Switch,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';

interface FiltersType {
  type: string;
  dismissed: boolean;
  search: string;
}

interface InsightsFiltersProps {
  filters: FiltersType;
  onFilterChange: (filters: Partial<FiltersType>) => void;
}

export function InsightsFilters({ filters, onFilterChange }: InsightsFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  return (
    <Stack
      direction={{ base: 'column', md: 'row' }}
      spacing={{ base: 4, md: 6 }}
      w="full"
      align={{ base: 'stretch', md: 'flex-end' }}
    >
      {/* Type Filter */}
      <FormControl flex="1">
        <FormLabel fontSize="sm" fontWeight="medium" mb={2}>
          Insight Type
        </FormLabel>
        <Select
          value={filters.type}
          onChange={(e) => onFilterChange({ type: e.target.value })}
          bg="white"
          size="md"
        >
          <option value="all">All Types</option>
          <option value="spending_increase">Spending Increases</option>
          <option value="budget_recommendation">Budget Recommendations</option>
          <option value="unusual_expense">Unusual Expenses</option>
          <option value="positive_reinforcement">Positive Reinforcement</option>
        </Select>
      </FormControl>

      {/* Search Input */}
      <FormControl flex="1">
        <FormLabel fontSize="sm" fontWeight="medium" mb={2}>
          Search
        </FormLabel>
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search insights..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            bg="white"
            size="md"
          />
        </InputGroup>
      </FormControl>

      {/* Show Dismissed Toggle */}
      <FormControl
        display="flex"
        alignItems="center"
        flex={{ base: 'none', md: '0 0 auto' }}
        mt={{ base: 2, md: 0 }}
      >
        <FormLabel htmlFor="show-dismissed" mb="0" fontSize="sm" fontWeight="medium">
          Show dismissed
        </FormLabel>
        <Switch
          id="show-dismissed"
          isChecked={filters.dismissed}
          onChange={(e) => onFilterChange({ dismissed: e.target.checked })}
          colorScheme="blue"
          size="md"
        />
      </FormControl>
    </Stack>
  );
}
