#!/bin/bash
# quick_context.sh: Ultra-compact project context in ONE call
# Usage: ./scripts/quick_context.sh

# This is the ULTIMATE token saver - get everything in one JSON

# Count stats
stories_count=$(find docs/sprint-artifacts -name "[0-9]*.md" 2>/dev/null | wc -l)
components_count=$(find src/components -name "*.tsx" 2>/dev/null | wc -l)
api_routes_count=$(find src/app/api -name "route.ts" 2>/dev/null | wc -l)

# Story status counts
in_progress=$(grep -l "in-progress\|In Progress" docs/sprint-artifacts/*.md 2>/dev/null | wc -l)
done_count=$(grep -l "DONE\|Done" docs/sprint-artifacts/*.md 2>/dev/null | wc -l)

# Git info
current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
uncommitted=$(git status --short 2>/dev/null | wc -l)

cat <<EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "project": "Smart-Budget-Application",
  "git": {
    "branch": "$current_branch",
    "uncommitted_changes": $uncommitted
  },
  "stats": {
    "stories": $stories_count,
    "components": $components_count,
    "api_routes": $api_routes_count
  },
  "story_status": {
    "in_progress": $in_progress,
    "done": $done_count
  },
  "hint": "Use analyze_context.sh, check_implementation.sh, story_analyzer.sh for details"
}
EOF
