"""Mutation harness: apply a source mutation, run a suite, report, revert.

THE VERDICT IS COMPUTED FROM THE TALLY. It is not parsed out of the output a
second, independent way.

WHY THAT IS THE DESIGN AND NOT A DETAIL. The previous version derived the verdict
from a regex over jest's per-test lines while printing the tally it had parsed
separately. On 2026-10-04 it printed "NO TEST WENT RED" directly beneath
"2 failed, 10 passed" — three times in a row, for three different mutations, each
of which had in fact gone red. The regex matched nothing because of a character
class, and the verdict believed the regex.

A summary that can disagree with the data it summarises is a second source of
truth about one fact, and the first one to speak is the one that gets believed.
Deriving the verdict from `failed` makes the disagreement impossible rather than
merely detectable.

AND ON HAVING SEEN IT MISREPORT AND CARRIED ON. This harness printed a wrong
verdict earlier the same day, next to a correct tally, and was used twice more
before being fixed. A KNOWN-broken instrument is worse than an unknown-broken
one: the surprise is already spent, so the next wrong reading does not startle
anybody. If this prints something that contradicts itself, stop and fix it before
using the result.

Usage:
  python mutate_harness.py <suite-path-pattern> <mutations.json>

mutations.json: [{"name": ..., "file": ..., "old": ..., "new": ...}, ...]
"""
import io
import json
import re
import shutil
import subprocess
import sys


def run_suite(pattern):
    """Return (failed, passed, total, raw_output). Counts come from ONE parse."""
    proc = subprocess.run(
        ['npx', 'jest', pattern, '--verbose'],
        capture_output=True, text=True, shell=True,
    )
    out = proc.stdout + proc.stderr

    tally = re.search(r'^Tests:\s+(.*)$', out, re.M)
    if not tally:
        # No tally means the suite did not run to completion — a crash, a bad
        # pattern, a syntax error from the mutation. That is NOT "no test went
        # red"; it is "the measurement did not happen", and the two must not
        # collapse into the same report.
        return None, None, None, out

    line = tally.group(1)
    failed = int((re.search(r'(\d+) failed', line) or [0, 0])[1])
    passed = int((re.search(r'(\d+) passed', line) or [0, 0])[1])
    total = int((re.search(r'(\d+) total', line) or [0, 0])[1])
    return failed, passed, total, out


def red_test_names(out):
    """Best-effort names, for the record. NEVER used to decide the verdict."""
    names = []
    for raw in out.splitlines():
        line = raw.strip()
        for marker in ('×', '✕', '✖'):
            if line.startswith(marker):
                names.append(re.sub(r'\s*\(\d+\s*ms\)$', '', line[len(marker):]).strip())
                break
    return names


def main():
    pattern, spec_path = sys.argv[1], sys.argv[2]
    mutations = json.loads(io.open(spec_path, encoding='utf-8').read())

    baseline_failed, _, baseline_total, _ = run_suite(pattern)
    print('baseline: %s failed of %s' % (baseline_failed, baseline_total))
    if baseline_failed is None:
        sys.exit('baseline did not produce a tally; fix that before mutating')
    if baseline_failed != 0:
        sys.exit('baseline is not green (%d failing) — mutation results would be '
                 'uninterpretable' % baseline_failed)

    results = []
    for m in mutations:
        src = m['file']
        bak = src + '.mutbak'
        shutil.copyfile(src, bak)
        try:
            text = io.open(src, encoding='utf-8').read()
            hits = text.count(m['old'])
            if hits != 1:
                print('\n=== %s\n    SKIPPED: anchor matched %d times' % (m['name'], hits))
                results.append((m['name'], None, 'anchor x%d' % hits))
                continue
            io.open(src, 'w', encoding='utf-8', newline='\n').write(
                text.replace(m['old'], m['new'], 1))

            failed, passed, total, out = run_suite(pattern)
            names = red_test_names(out)

            # THE VERDICT, COMPUTED FROM THE TALLY. Nothing else decides it.
            if failed is None:
                verdict = 'NO TALLY — the suite did not complete; measurement failed'
            elif failed > 0:
                verdict = 'RED (%d of %d failed)' % (failed, total)
            else:
                verdict = '*** GREEN — THE GUARD IS NOT COVERED (0 of %d failed) ***' % total

            print('\n=== %s\n    %s' % (m['name'], verdict))
            # Names are printed as supporting detail, and their ABSENCE is
            # labelled as a parsing gap rather than allowed to imply anything
            # about whether tests failed.
            if names:
                for n in names:
                    print('    red: %s' % n)
            elif failed:
                print('    (test names could not be parsed from the output; the')
                print('     tally above is the measurement)')
            results.append((m['name'], failed, verdict))
        finally:
            shutil.copyfile(bak, src)
            import os
            os.remove(bak)

    failed_after, _, total_after, _ = run_suite(pattern)
    print('\n=== reverted: %s failed of %s' % (failed_after, total_after))
    if failed_after != 0:
        print('    *** REVERT DID NOT RESTORE GREEN — the tree is dirty ***')

    print('\n=== summary')
    for name, failed, verdict in results:
        print('  %-62s %s' % (name[:62], verdict))
    uncovered = [n for n, f, _ in results if f == 0]
    if uncovered:
        print('\n  GUARDS NOT COVERED BY ANY TEST:')
        for n in uncovered:
            print('    %s' % n)


if __name__ == '__main__':
    main()
