/**
 * Tests for seedCategoriesService
 * Validates category seeding logic and idempotency
 *
 * MIGRATED to `@/test-utils/supabaseChain`. This file used to import the GLOBAL
 * default mock (`__tests__/setup/supabase-mock`) and overwrite its shared `from`
 * per test - one of only two files that depended on that default at all. It now
 * owns its server mock, which is what lets the global default be deleted.
 */

import { seedDefaultCategories } from '@/lib/services/seedCategoriesService'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseMock, type QueryResult } from '@/test-utils/supabaseChain'
import { mockUser, mockCategories } from '../../setup/fixtures'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

/** `categories`: the head-count read, then (if seeding) the bulk insert. */
function seedDb(categories: QueryResult | QueryResult[]) {
  const db = createSupabaseMock({ tables: { categories } })
  mockCreateClient.mockResolvedValue(db.client)
  return db
}

describe('seedCategoriesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('seedDefaultCategories', () => {
    it('should seed 11 default categories for new user', async () => {
      seedDb([
        // User has no existing categories (count = 0)
        { data: null, count: 0, error: null },
        // The bulk insert returns the 11 defaults
        { data: mockCategories.slice(0, 11), error: null },
      ])

      const result = await seedDefaultCategories(mockUser.id)

      expect(result.success).toBe(true)
      expect(result.count).toBe(11)
    })

    it('should be idempotent - not create duplicates if called multiple times', async () => {
      // User already has 11 categories
      const db = seedDb({ data: null, count: 11, error: null })

      const result = await seedDefaultCategories(mockUser.id)

      // Should return early without inserting. The absence is PAIRED with the
      // presence of the count read, or "no insert" would also hold if the
      // service never queried at all.
      expect(result.success).toBe(true)
      expect(result.count).toBe(0)
      expect(db.from).toHaveBeenCalledWith('categories')
      expect(db.allCallsTo('categories', 'insert')).toEqual([])
    })

    it('should handle database errors gracefully', async () => {
      seedDb({ data: null, count: null, error: { message: 'Database connection failed' } })

      await expect(seedDefaultCategories(mockUser.id)).rejects.toThrow(
        'Failed to check existing categories'
      )
    })
  })
})
