#!/bin/bash
# check_implementation.sh: Verify if a feature/function/component exists
# Usage: ./scripts/check_implementation.sh <search_term> [file_type]

SEARCH_TERM=$1
FILE_TYPE=${2:-"*"}

if [ -z "$SEARCH_TERM" ]; then
    echo '{"error": "No search term provided"}'
    exit 1
fi

# Search for the term in codebase
find_in_files() {
    local term=$1
    local type=$2

    case $type in
        "component")
            find src/components -name "*.tsx" -exec grep -l "$term" {} \; 2>/dev/null
            ;;
        "api")
            find src/app/api -name "*.ts" -exec grep -l "$term" {} \; 2>/dev/null
            ;;
        "type")
            find src/types -name "*.ts" -exec grep -l "$term" {} \; 2>/dev/null
            ;;
        "service")
            find src/lib/services -name "*.ts" -exec grep -l "$term" {} \; 2>/dev/null
            ;;
        *)
            find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "$term" 2>/dev/null
            ;;
    esac
}

# Get matches
matches=$(find_in_files "$SEARCH_TERM" "$FILE_TYPE")
match_count=$(echo "$matches" | grep -c . 2>/dev/null || echo "0")

# Check if implemented
if [ "$match_count" -gt 0 ]; then
    implemented="true"
    # Get first few matches
    top_matches=$(echo "$matches" | head -3 | sed 's/.*\///;s/\..*//')
else
    implemented="false"
    top_matches=""
fi

# Compact JSON output
cat <<EOF
{
  "search_term": "$SEARCH_TERM",
  "file_type": "$FILE_TYPE",
  "implemented": $implemented,
  "match_count": $match_count,
  "locations": [
    $(echo "$top_matches" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//' | grep -v '^$')
  ]
}
EOF
