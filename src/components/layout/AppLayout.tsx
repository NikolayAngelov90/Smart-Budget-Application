'use client';

import { useState, useEffect } from 'react';
import { Box, Flex, useDisclosure, useBreakpointValue } from '@chakra-ui/react';
import { mutate } from 'swr';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import FloatingActionButton from '@/components/common/FloatingActionButton';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSE_KEY = 'sidebar-collapsed';

export function AppLayout({ children }: AppLayoutProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isOpen: isMobileNavOpen, onOpen: onMobileNavOpen, onClose: onMobileNavClose } = useDisclosure();

  // Responsive default: collapsed on tablet (md), expanded on desktop (lg)
  const defaultCollapsed = useBreakpointValue({ base: false, md: true, lg: false }) ?? false;

  // Sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(defaultCollapsed);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved preference from localStorage on mount
  useEffect(() => {
    const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
    if (savedCollapsed !== null) {
      setIsSidebarCollapsed(savedCollapsed === 'true');
    } else {
      setIsSidebarCollapsed(defaultCollapsed);
    }
    setIsInitialized(true);
  }, [defaultCollapsed]);

  // Update localStorage when collapse state changes
  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(newValue));
      return newValue;
    });
  };

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleSuccess = async () => {
    console.log('[AppLayout] Transaction success callback triggered - refreshing dashboard...');

    // Small delay to ensure database transaction is committed
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('[AppLayout] Triggering SWR revalidation for dashboard data...');

    // Force immediate revalidation of dashboard stats (bypasses deduplication)
    await mutate('/api/dashboard/stats', undefined, { revalidate: true });

    // Force immediate revalidation of spending by category
    await mutate('/api/dashboard/spending-by-category', undefined, { revalidate: true });

    // Force immediate revalidation of spending trends
    await mutate('/api/dashboard/trends', undefined, { revalidate: true });

    // Also trigger revalidation with all possible query params
    await mutate(
      (key) => typeof key === 'string' && (
        key.startsWith('/api/dashboard/stats') ||
        key.startsWith('/api/dashboard/spending-by-category') ||
        key.startsWith('/api/dashboard/trends')
      ),
      undefined,
      { revalidate: true }
    );

    console.log('[AppLayout] Dashboard data refresh complete!');
  };

  return (
    <Flex direction="column" minH="100vh">
      <Header onMenuClick={onMobileNavOpen} />
      <Flex flex={1}>
        <Box display={{ base: 'none', md: 'block' }}>
          {isInitialized && (
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapse}
            />
          )}
        </Box>
        <Box flex={1} p={6} maxW="1200px" mx="auto" w="full">
          {children}
        </Box>
      </Flex>

      {/* Mobile Navigation Drawer */}
      <MobileNav isOpen={isMobileNavOpen} onClose={onMobileNavClose} />

      {/* Floating Action Button - Always visible on all pages */}
      <FloatingActionButton onClick={handleOpenModal} />

      {/* Transaction Entry Modal */}
      <TransactionEntryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
      />
    </Flex>
  );
}
