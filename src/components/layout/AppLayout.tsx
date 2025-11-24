'use client';

import { useState } from 'react';
import { Box, Flex, useDisclosure } from '@chakra-ui/react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import FloatingActionButton from '@/components/common/FloatingActionButton';
import TransactionEntryModal from '@/components/transactions/TransactionEntryModal';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isOpen: isMobileNavOpen, onOpen: onMobileNavOpen, onClose: onMobileNavClose } = useDisclosure();

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleSuccess = () => {
    // TODO: In future, trigger data refresh for dashboard/transaction list
    console.log('Transaction created successfully!');
  };

  return (
    <Flex direction="column" minH="100vh">
      <Header onMenuClick={onMobileNavOpen} />
      <Flex flex={1}>
        <Box display={{ base: 'none', md: 'block' }}>
          <Sidebar />
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
