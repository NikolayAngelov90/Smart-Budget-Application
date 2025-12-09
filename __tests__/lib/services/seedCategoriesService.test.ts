/**
 * Tests for seedCategoriesService
 * Validates category seeding logic and idempotency
 */

import { seedDefaultCategories } from '@/lib/services/seedCategoriesService'
import { mockSupabaseClient } from '../../setup/supabase-mock'
import { mockUser, mockCategories } from '../../setup/fixtures'

describe('seedCategoriesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('seedDefaultCategories', () => {
    it('should seed 11 default categories for new user', async () => {
      // Mock: User has no existing categories (count = 0)
      const selectChain = {
        eq: jest.fn().mockResolvedValue({
          count: 0,
          error: null,
        }),
      }
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: mockCategories.slice(0, 11), // 11 default categories
            error: null,
          }),
        }),
      })

      const result = await seedDefaultCategories(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.count).toBe(11)
    })

    it('should be idempotent - not create duplicates if called multiple times', async () => {
      // Mock: User already has 11 categories
      const selectChain = {
        eq: jest.fn().mockResolvedValue({
          count: 11,
          error: null,
        }),
      }
      const insertMock = jest.fn()
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
        insert: insertMock,
      })

      const result = await seedDefaultCategories(mockUser.id)

      // Should return early without inserting
      expect(result.success).toBe(true)
      expect(result.count).toBe(0)
      expect(insertMock).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Mock: Database error
      const selectChain = {
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Database connection failed' },
        }),
      }
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue(selectChain),
      })

      await expect(seedDefaultCategories(mockUser.id)).rejects.toThrow('Failed to check existing categories')
    })
  })
})
