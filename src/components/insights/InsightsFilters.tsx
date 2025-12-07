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
      spacing={{ base: 4, md: 4 }}
      w="full"
      align={{ base: 'stretch', md: 'flex-end' }}
    >
      {/* Type Filter */}
      <FormControl flex="1" minW={{ base: 'auto', md: '200px' }} maxW={{ base: 'full', md: '300px' }}>
        <FormLabel htmlFor="insight-type-filter" fontSize="sm" fontWeight="medium" mb={2}>
          Insight Type
        </FormLabel>
        <Select
          id="insight-type-filter"
          value={filters.type || 'all'}
          onChange={(e) => onFilterChange({ type: e.target.value })}
          bg="white"
          size="md"
          borderColor="gray.300"
          _hover={{ borderColor: 'gray.400' }}
          _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
          w="full"
        >
          <option value="all">All Types</option>
          <option value="spending_increase">Spending Increases</option>
          <option value="budget_recommendation">Budget Recommendations</option>
          <option value="unusual_expense">Unusual Expenses</option>
          <option value="positive_reinforcement">Positive Reinforcement</option>
        </Select>
      </FormControl>

      {/* Search Input */}
      <FormControl flex="1" minW={{ base: 'auto', md: '200px' }} maxW={{ base: 'full', md: '300px' }}>
        <FormLabel htmlFor="search-insights" fontSize="sm" fontWeight="medium" mb={2}>
          Search
        </FormLabel>
        <InputGroup size="md">
          <InputLeftElement pointerEvents="none" height="full">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            id="search-insights"
            placeholder="Search insights..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            bg="white"
            size="md"
            paddingLeft="2.5rem"
            borderColor="gray.300"
            _hover={{ borderColor: 'gray.400' }}
            _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3182ce' }}
          />
        </InputGroup>
      </FormControl>

      {/* Show Dismissed Toggle */}
      <FormControl
        display="flex"
        alignItems="center"
        flex="0 0 auto"
        mt={{ base: 2, md: 0 }}
        gap={2}
      >
        <FormLabel htmlFor="show-dismissed" mb="0" fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
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
