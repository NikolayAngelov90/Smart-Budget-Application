#!/bin/bash
# analyze_context.sh: Fast project structure analysis with minimal tokens
# Usage: ./scripts/analyze_context.sh [optional_focus_area]

FOCUS_AREA=${1:-"all"}

generate_summary() {
    local focus=$1

    # Stories overview
    local stories=$(find docs/sprint-artifacts -name "*.md" -not -name "*context.xml" -not -name "index.md" 2>/dev/null | wc -l)
    local story_names=$(find docs/sprint-artifacts -name "[0-9]*-*.md" -type f 2>/dev/null | sed 's/.*\///;s/\.md$//' | head -10)

    # Components count
    local components=$(find src/components -name "*.tsx" 2>/dev/null | wc -l)
    local component_names=$(find src/components -name "*.tsx" 2>/dev/null | sed 's/.*\///;s/\.tsx$//' | head -10)

    # API routes
    local api_routes=$(find src/app/api -name "route.ts" 2>/dev/null | sed 's|src/app/api/||;s|/route.ts||' | head -10)

    # Types
    local type_files=$(find src/types -name "*.ts" 2>/dev/null | sed 's/.*\///;s/\.types\.ts$//' | head -10)

    # Services
    local services=$(find src/lib/services -name "*.ts" 2>/dev/null | sed 's/.*\///;s/Service\.ts$//' | head -10)

    # Recent git changes
    local changed_files=$(git diff --name-only HEAD~1 2>/dev/null | head -5)

    # Output compact JSON
    cat <<EOF
{
  "project": "Smart-Budget-Application",
  "focus": "$focus",
  "stats": {
    "stories": $stories,
    "components": $components,
    "api_routes": $(echo "$api_routes" | wc -l)
  },
  "stories_list": [
    $(echo "$story_names" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//')
  ],
  "components_list": [
    $(echo "$component_names" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//')
  ],
  "api_routes_list": [
    $(echo "$api_routes" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//')
  ],
  "types_list": [
    $(echo "$type_files" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//')
  ],
  "services_list": [
    $(echo "$services" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//')
  ],
  "recent_changes": [
    $(echo "$changed_files" | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//')
  ]
}
EOF
}

# Execute
generate_summary "$FOCUS_AREA"
