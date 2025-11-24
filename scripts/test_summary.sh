#!/bin/bash
# test_summary.sh: Run tests and return compact summary
# Usage: ./scripts/test_summary.sh [test_pattern]

TEST_PATTERN=${1:-""}

# Run tests and capture output
if [ -z "$TEST_PATTERN" ]; then
    # Run all tests
    npm test -- --passWithNoTests 2>&1 | tee test_output.tmp
else
    # Run specific test pattern
    npm test -- "$TEST_PATTERN" --passWithNoTests 2>&1 | tee test_output.tmp
fi

TEST_EXIT_CODE=${PIPESTATUS[0]}

# Parse test output for summary
parse_test_results() {
    local output_file=$1

    # Extract key metrics
    local passed=$(grep -o "Tests:.*passed" "$output_file" | grep -o "[0-9]* passed" | grep -o "[0-9]*" || echo "0")
    local failed=$(grep -o "Tests:.*failed" "$output_file" | grep -o "[0-9]* failed" | grep -o "[0-9]*" || echo "0")
    local total=$(grep -o "Tests:.*total" "$output_file" | grep -o "[0-9]* total" | grep -o "[0-9]*" || echo "0")

    # Get test suites info
    local suites_passed=$(grep -o "Test Suites:.*passed" "$output_file" | grep -o "[0-9]* passed" | grep -o "[0-9]*" || echo "0")
    local suites_failed=$(grep -o "Test Suites:.*failed" "$output_file" | grep -o "[0-9]* failed" | grep -o "[0-9]*" || echo "0")

    # Extract failed test names if any
    local failed_tests=$(grep "FAIL" "$output_file" | head -5 | sed 's/.*FAIL //;s/ (.*//')

    # Build JSON
    cat <<EOF
{
  "status": $([ $TEST_EXIT_CODE -eq 0 ] && echo '"passed"' || echo '"failed"'),
  "exit_code": $TEST_EXIT_CODE,
  "tests": {
    "passed": $passed,
    "failed": $failed,
    "total": $total
  },
  "suites": {
    "passed": $suites_passed,
    "failed": $suites_failed
  },
  "failed_tests": [
    $(echo "$failed_tests" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//' | grep -v '^$')
  ],
  "pattern": "$TEST_PATTERN"
}
EOF
}

# Generate summary
parse_test_results "test_output.tmp"

# Cleanup
rm -f test_output.tmp

exit $TEST_EXIT_CODE
