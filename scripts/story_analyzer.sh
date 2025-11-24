#!/bin/bash
# story_analyzer.sh: Analyze BMAD story files and return compact summary
# Usage: ./scripts/story_analyzer.sh <story_number> OR ./scripts/story_analyzer.sh all

STORY_NUM=$1

if [ -z "$STORY_NUM" ]; then
    echo '{"error": "No story number provided. Usage: ./story_analyzer.sh <story_num> or all"}'
    exit 1
fi

analyze_story() {
    local story_file=$1
    local story_name=$(basename "$story_file" .md)

    if [ ! -f "$story_file" ]; then
        echo "null"
        return
    fi

    # Extract key sections
    local title=$(grep "^# " "$story_file" | head -1 | sed 's/^# //')
    local status=$(grep -A1 "## Status" "$story_file" | tail -1 | sed 's/^[- ]*//' || echo "unknown")

    # Count tasks
    local total_tasks=$(grep -c "^- \[" "$story_file" || echo "0")
    local completed_tasks=$(grep -c "^- \[x\]" "$story_file" || echo "0")

    # Extract acceptance criteria count
    local acceptance_criteria=$(grep -c "^- \[.\] AC" "$story_file" || echo "0")

    # Check if context exists
    local context_file="${story_file%.md}.context.xml"
    local has_context="false"
    [ -f "$context_file" ] && has_context="true"

    # Dependencies mentioned
    local deps=$(grep -i "depends on\|requires\|needs" "$story_file" | head -2 | sed 's/^/    /')

    cat <<EOF
  {
    "story": "$story_name",
    "title": "$title",
    "status": "$status",
    "tasks": {
      "total": $total_tasks,
      "completed": $completed_tasks,
      "progress": $(awk "BEGIN {printf \"%.0f\", ($completed_tasks/$total_tasks)*100}" 2>/dev/null || echo "0")
    },
    "acceptance_criteria": $acceptance_criteria,
    "has_context": $has_context
  }
EOF
}

if [ "$STORY_NUM" = "all" ]; then
    # Analyze all stories
    echo "{"
    echo '  "project": "Smart-Budget-Application",'
    echo '  "stories": ['

    first=true
    for story in docs/sprint-artifacts/[0-9]*-*.md; do
        if [ -f "$story" ]; then
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            analyze_story "$story"
        fi
    done

    echo ""
    echo "  ]"
    echo "}"
else
    # Analyze specific story
    story_file=$(find docs/sprint-artifacts -name "*${STORY_NUM}*.md" -type f | head -1)

    if [ -z "$story_file" ]; then
        echo "{\"error\": \"Story $STORY_NUM not found\"}"
        exit 1
    fi

    echo "{"
    analyze_story "$story_file"
    echo "}"
fi
