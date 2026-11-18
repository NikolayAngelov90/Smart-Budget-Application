// MUST-NOT-FIND fixture for scripts/ci/chain-mock-rule.json: look-alikes that
// are not hand-rolled chains. NOTHING here may be flagged.
const start = '2026-01-01';
export const range = { from: start, to: '2026-02-01' };
export const literal = { from: '2026-01-01' };
export const storage = { storage: { from: jest.fn() } };
export const arr = Array.from([1, 2]);
export const fn = jest.fn();
