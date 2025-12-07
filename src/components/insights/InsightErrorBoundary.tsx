'use client';

import React, { Component, ReactNode } from 'react';
import { Box, Text, VStack, Button } from '@chakra-ui/react';
import { WarningIcon } from '@chakra-ui/icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Insight components
 * Catches rendering errors in metadata display and provides graceful fallback
 *
 * Story 6.4: Insight Metadata and Supporting Data
 * Addresses code review finding [MEDIUM-3]: Error boundary for metadata rendering failures
 */
export class InsightErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error('InsightErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Box
          p={6}
          borderRadius="md"
          bg="red.50"
          border="1px"
          borderColor="red.200"
        >
          <VStack spacing={3} align="start">
            <Box display="flex" alignItems="center" gap={2}>
              <WarningIcon color="red.500" />
              <Text fontSize="sm" fontWeight="semibold" color="red.800">
                Unable to display insight details
              </Text>
            </Box>
            <Text fontSize="sm" color="red.700">
              There was an error loading the detailed information for this insight.
              The data may be incomplete or in an unexpected format.
            </Text>
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <Text fontSize="xs" color="red.600" fontFamily="mono">
                {this.state.error.message}
              </Text>
            )}
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={this.handleReset}
            >
              Try Again
            </Button>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}
