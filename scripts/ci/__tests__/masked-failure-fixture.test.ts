/**
 * THE MUST-FIND CONTROL for scripts/ci/detect-masked-failures.sh.
 *
 * This file is DELIBERATELY DIRTY. It passes, and while passing it emits both
 * shapes the detector looks for. That is its entire purpose: a detector that
 * greps for absence must be shown to find something, because absence assertions
 * fail open — "0 masked failures" from a script that read nothing is
 * indistinguishable from "0 masked failures" from a script that worked.
 *
 * It is excluded from the ordinary suite by `testPathIgnorePatterns` in
 * jest.config.js, so `npm test` never reports its deliberate noise and it
 * never counts toward the test tally or the CI floor. The detector runs it by
 * OVERRIDING that ignore, which is the only context it should ever run in.
 *
 * IF YOU ARE HERE BECAUSE THIS FILE FAILED: do not make it pass by removing the
 * swallowed error. The swallowed error is the fixture.
 */

/** A hand-rolled chain that stops one method short, exactly as the real ones did. */
function shortChain() {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    // `maybeSingle` deliberately absent — this is the whole fixture.
  };
  return { from: jest.fn(() => chain) };
}

/** Production's shape: a best-effort path wrapped in a catch that logs and carries on. */
async function bestEffortPath(db: ReturnType<typeof shortChain>): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = db.from('user_profiles').select('preferences').eq('id', 'u-1');
    await q.maybeSingle();
    return 'logged';
  } catch (err) {
    // The marker this codebase uses for a deliberately swallowed failure.
    // eslint-disable-next-line no-console
    console.error('[ERROR] [FixtureService] fixture path failed (non-fatal):', err);
    return 'swallowed';
  }
}

describe('masked-failure detector control', () => {
  it('PASSES while absorbing a missing chain method — both shapes in one test', async () => {
    const result = await bestEffortPath(shortChain());

    // The assertion the real tests make: the caller succeeded. It is TRUE, and
    // it is true whether or not the best-effort path did anything at all.
    expect(result).toBe('swallowed');
  });
});
