/**
 * Manual mock for ioredis
 * Story 9.1: Prevents connection issues in Jest tests
 */

const IORedis = jest.fn().mockImplementation(() => ({
  ping: jest.fn().mockResolvedValue('PONG'),
})) as any;

export default IORedis;
