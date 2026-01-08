/**
 * Manual mock for @upstash/redis
 * Story 9.1: Prevents ESM import issues in Jest tests
 */

export const Redis = jest.fn().mockImplementation(() => ({
  ping: jest.fn().mockResolvedValue('PONG'),
})) as any;

export default Redis;
