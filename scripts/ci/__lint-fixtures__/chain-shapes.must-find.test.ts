// MUST-FIND fixture for scripts/ci/chain-mock-rule.json. Every line marked FIND
// must be flagged exactly once: 6 in all. Not a jest test (jest only runs files
// under __tests__/), and outside the lint gate (.eslintignore has scripts/) -
// it is linted explicitly by chain-mock-meter.sh, which requires the count.
const mockFrom = jest.fn();
export const s1 = { from: jest.fn() }; // FIND: property
export const s1b = { from: jest.fn().mockReturnValue({}) }; // FIND: property, chained
const from = jest.fn((table: string) => table); // FIND: variable, passed as { from }
export const s2use = { from };
const mockClient: Record<string, unknown> = {};
mockClient.from = jest.fn(); // FIND: assignment
export const s3 = { from: mockFrom }; // FIND: identifier
export const s4 = { from: (t: string) => mockFrom(t) }; // FIND: arrow
