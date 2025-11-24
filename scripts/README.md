# Token-Saving Scripts for Claude Code

These scripts dramatically reduce token usage by returning **compact JSON summaries** instead of full file contents.

## 🎯 Purpose

When Claude Code executes repetitive operations (reading multiple files, checking implementations, running tests), tokens add up quickly. These scripts batch operations and return only essential information.

**Example savings**:
- **Before**: Reading 10 files = ~20,000 tokens
- **After**: One script call = ~500 tokens
- **Savings**: ~95% reduction

---

## 📜 Available Scripts

### 1. `analyze_context.sh` - Project Structure Analysis

Fast overview of the entire project structure.

**Usage**:
```bash
bash scripts/analyze_context.sh [focus_area]
```

**Example**:
```bash
bash scripts/analyze_context.sh all
```

**Returns**:
- Story count and names
- Component list
- API routes
- Type definitions
- Services
- Recent git changes

**Token savings**: ~90% vs reading individual files

---

### 2. `check_implementation.sh` - Feature Verification

Quickly check if a feature/function/component exists without reading files.

**Usage**:
```bash
bash scripts/check_implementation.sh <search_term> [file_type]
```

**File types**: `component`, `api`, `type`, `service`, or `*` (all)

**Examples**:
```bash
# Check if CategoryModal exists
bash scripts/check_implementation.sh "CategoryModal" component

# Check for Prisma usage
bash scripts/check_implementation.sh "prisma" "*"

# Check API endpoint
bash scripts/check_implementation.sh "POST" api
```

**Returns**:
- Whether feature is implemented
- Match count
- Top file locations

**Token savings**: ~85% vs Grep + Read operations

---

### 3. `test_summary.sh` - Compact Test Results

Run tests and get only the summary, not full output.

**Usage**:
```bash
bash scripts/test_summary.sh [test_pattern]
```

**Examples**:
```bash
# Run all tests
bash scripts/test_summary.sh

# Run specific tests
bash scripts/test_summary.sh "categories"
```

**Returns**:
- Pass/fail status
- Test counts (passed, failed, total)
- Failed test names (if any)

**Token savings**: ~98% vs full test output

---

### 4. `story_analyzer.sh` - BMAD Story Analysis

Analyze BMAD story files without reading full content.

**Usage**:
```bash
bash scripts/story_analyzer.sh <story_number|all>
```

**Examples**:
```bash
# Analyze specific story
bash scripts/story_analyzer.sh 4-1

# Analyze all stories
bash scripts/story_analyzer.sh all
```

**Returns**:
- Story status
- Task progress (completed/total)
- Acceptance criteria count
- Whether context file exists

**Token savings**: ~92% vs reading story markdown files

---

## 🚀 How Claude Code Uses These

### Before (High Token Usage):
```
Claude: Read story 4-1
Claude: Read story 4-2
Claude: Read story 4-3
Claude: Grep for "category"
Claude: Read CategoryModal.tsx
Claude: Read category.types.ts
...
Total: ~25,000 tokens
```

### After (Low Token Usage):
```
Claude: bash scripts/story_analyzer.sh all
Claude: bash scripts/check_implementation.sh "category"
...
Total: ~1,000 tokens
```

---

## 🔧 Integration with BMAD Workflows

These scripts are designed to work seamlessly with BMAD Method workflows:

- **Sprint Planning**: Use `story_analyzer.sh all` to get overview
- **Story Context**: Use `analyze_context.sh` before building context
- **Dev Story**: Use `check_implementation.sh` to verify existing code
- **Code Review**: Use `test_summary.sh` to validate tests

---

## 💡 Best Practices

1. **Use scripts first** before reading individual files
2. **Batch operations** - run script once vs multiple tool calls
3. **Cache results** - scripts are fast, run them when needed
4. **Combine scripts** - use multiple in same bash session

---

## 🛠️ Requirements

- Git Bash (Windows) or Bash shell (Linux/Mac)
- Node.js (for test_summary.sh)
- Project must follow BMAD Method structure

---

## 📊 Token Usage Comparison

| Operation | Traditional | With Scripts | Savings |
|-----------|-------------|--------------|---------|
| Read 10 stories | ~20,000 | ~1,000 | 95% |
| Check 5 implementations | ~8,000 | ~400 | 95% |
| Run tests | ~15,000 | ~300 | 98% |
| Project overview | ~12,000 | ~500 | 96% |

**Average savings**: ~95% token reduction

---

## 🐛 Troubleshooting

**Scripts not executable?**
```bash
chmod +x scripts/*.sh
```

**Windows Git Bash issues?**
- Ensure Git Bash is installed
- Use forward slashes in paths
- Run from project root

**Script returns empty JSON?**
- Check you're in project root
- Verify file paths exist
- Check script has execute permissions

---

## 🔮 Future Enhancements

- `diff_summary.sh` - Git diff compact view
- `dependency_check.sh` - Package dependency verification
- `build_summary.sh` - Build error extraction
- `performance_check.sh` - Bundle size analysis

---

**Created for**: Smart Budget Application
**Compatible with**: BMAD Method workflows
**Maintained by**: Claude Code automation
