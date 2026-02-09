/**
 * Onboarding Modal Component
 * Story 2.6: First-Time User Onboarding
 *
 * Multi-step onboarding flow for new users explaining key features:
 * - Step 1: Transaction entry
 * - Step 2: Dashboard and charts
 * - Step 3: AI insights
 */

import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  HStack,
  Box,
  Icon,
  Progress,
  Heading,
} from '@chakra-ui/react';
import { AddIcon, ViewIcon, StarIcon } from '@chakra-ui/icons';
import { useTranslations } from 'next-intl';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface OnboardingStep {
  titleKey: string;
  descriptionKey: string;
  icon: typeof AddIcon;
  iconColor: string;
  iconBg: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    titleKey: 'step1Title',
    descriptionKey: 'step1Description',
    icon: AddIcon,
    iconColor: 'white',
    iconBg: '#2b6cb0',
  },
  {
    titleKey: 'step2Title',
    descriptionKey: 'step2Description',
    icon: ViewIcon,
    iconColor: 'white',
    iconBg: '#38a169',
  },
  {
    titleKey: 'step3Title',
    descriptionKey: 'step3Description',
    icon: StarIcon,
    iconColor: 'white',
    iconBg: '#d69e2e',
  },
];

export function OnboardingModal({
  isOpen,
  onComplete,
  onSkip,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');

  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const currentStepData = ONBOARDING_STEPS[currentStep];
  if (!currentStepData) return null;
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      isCentered
      closeOnOverlayClick={false}
      size={{ base: 'full', md: 'xl' }}
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <ModalContent mx={{ base: 0, md: 4 }} my={{ base: 0, md: 4 }}>
        <ModalHeader pt={8} pb={4}>
          <VStack spacing={4} align="stretch">
            <Heading as="h2" size="lg" textAlign="center" color="gray.800">
              {t('welcome')}
            </Heading>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              {t('welcomeDescription')}
            </Text>
            <Progress
              value={progress}
              size="sm"
              colorScheme="blue"
              borderRadius="full"
            />
          </VStack>
        </ModalHeader>

        <ModalBody py={8}>
          <VStack spacing={8} align="center">
            {/* Icon */}
            <Box
              bg={currentStepData.iconBg}
              borderRadius="full"
              p={8}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon
                as={currentStepData.icon}
                boxSize={16}
                color={currentStepData.iconColor}
              />
            </Box>

            {/* Content */}
            <VStack spacing={4} textAlign="center" maxW="md">
              <Heading as="h3" size="md" color="gray.800">
                {t(currentStepData.titleKey)}
              </Heading>
              <Text color="gray.700" fontSize="md" lineHeight="tall">
                {t(currentStepData.descriptionKey)}
              </Text>
            </VStack>

            {/* Step Indicator */}
            <HStack spacing={2}>
              {ONBOARDING_STEPS.map((_, index) => (
                <Box
                  key={index}
                  w={3}
                  h={3}
                  borderRadius="full"
                  bg={index === currentStep ? '#2b6cb0' : 'gray.300'}
                  transition="all 0.3s"
                />
              ))}
            </HStack>
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="space-between" pb={8}>
          <Button
            variant="ghost"
            onClick={handleSkip}
            color="gray.600"
            _hover={{ bg: 'gray.100' }}
          >
            {tCommon('skip')}
          </Button>

          <Button
            bg="#2b6cb0"
            color="white"
            _hover={{ bg: '#2c5282' }}
            _active={{ bg: '#2c5282' }}
            size="lg"
            minH="44px"
            px={8}
            onClick={handleNext}
            rightIcon={isLastStep ? <StarIcon /> : undefined}
          >
            {isLastStep ? t('letsGetStarted') : tCommon('next')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
