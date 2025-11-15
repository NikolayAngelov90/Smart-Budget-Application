'use client';

import { Box, Flex } from '@chakra-ui/react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <Flex direction="column" minH="100vh">
      <Header />
      <Flex flex={1}>
        <Box display={{ base: 'none', md: 'block' }}>
          <Sidebar />
        </Box>
        <Box flex={1} p={6}>
          {children}
        </Box>
      </Flex>
      <MobileNav />
    </Flex>
  );
}
