'use client';

import { useState, useEffect } from 'react';
import { Box, Flex, useDisclosure, useBreakpointValue } from '@chakra-ui/react';
import { mutate } from 'swr';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import FloatingActionButton from '@/components/common/FloatingActionButton';
import { BottomNav } from './BottomNav';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

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
    <Flex direction="column" h="100vh" overflow="hidden">
      <Header onMenuClick={onMobileNavOpen} />
      <OfflineBanner />
      <Flex flex={1} overflow="hidden">
        <Box display={{ base: 'none', md: 'block' }}>
          {isInitialized && (
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapse}
            />
          )}
        </Box>
        <Box
          flex={1}
          p={{ base: 4, md: 6 }}
          pb={{ base: '80px', md: 6 }}
          overflowY="auto"
          overflowX="hidden"
          w="full"
          data-scroll-container="true"
        >
          {children}
        </Box>
      </Flex>

      {/* Mobile Navigation Drawer */}
      <MobileNav isOpen={isMobileNavOpen} onClose={onMobileNavClose} />

      {/* Bottom Navigation Bar - Mobile only (AC-10.8.1, AC-10.8.2) */}
      <BottomNav onAddClick={handleOpenModal} />

      {/* Floating Action Button - Tablet/Desktop only (AC-10.8.2: hidden on mobile where BottomNav Add tab takes over) */}
      <Box display={{ base: 'none', md: 'block' }}>
        <FloatingActionButton onClick={handleOpenModal} />
      </Box>

      {/* Transaction Entry Modal */}
      <TransactionEntryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
      />

      {/* PWA Install Prompt (Story 10-7: AC-10.7.4) */}
      <PWAInstallPrompt />
    </Flex>
  );
}
