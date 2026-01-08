/**
 * Manual mock for @upstash/ratelimit
 * Story 9.1: Prevents ESM import issues in Jest tests
 */

const RatelimitMock = jest.fn().mockImplementation(() => ({
  limit: jest.fn().mockResolvedValue({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60000,
  }),
})) as any;

Object.defineProperty(RatelimitMock, 'slidingWindow', {
  value: jest.fn((limit: number, window: string) => ({
    limit,
    window,
  })),
  writable: true,
});

export { RatelimitMock as Ratelimit };
export default RatelimitMock;
