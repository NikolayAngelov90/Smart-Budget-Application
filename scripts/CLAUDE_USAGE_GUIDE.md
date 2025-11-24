# Token-Saving Scripts - Claude Code Usage Guide

**FOR CLAUDE CODE AGENT USE**

This guide helps Claude Code decide when to use token-saving scripts vs direct tool calls.

---

## 🎯 Golden Rule

**ALWAYS use scripts when**:
- Reading 3+ files for context
- Checking multiple implementations
- Analyzing story progress
- Getting project overview

**Scripts save ~90-95% tokens!**

---

## 📜 Script Selection Matrix

| User Request | Use This Script | Instead Of |
|--------------|----------------|------------|
| "What's the project status?" | `quick_context.sh` | Read multiple files |
| "Show me all stories" | `story_analyzer.sh all` | Read all story .md files |
| "What's story 4-1 status?" | `story_analyzer.sh 4-1` | Read specific story |
| "Is CategoryModal implemented?" | `check_implementation.sh "CategoryModal" component` | Grep + Read |
| "Show me all components" | `analyze_context.sh` | Glob + Read each |
| "Run tests and show results" | `test_summary.sh` | npm test (full output) |
| "What files changed recently?" | `analyze_context.sh` | git log + Read |

---

## 🚀 Common Workflows

### Starting a New Story
```bash
# Get context in ONE call instead of 10+ reads
bash scripts/story_analyzer.sh 4-2
bash scripts/check_implementation.sh "category"
bash scripts/analyze_context.sh
```

**Token savings**: 20,000 → 1,500 tokens (~93%)

### Checking Implementation Status
```bash
# Instead of Grep + Read multiple files
bash scripts/check_implementation.sh "seedCategories" service
```

**Token savings**: 8,000 → 400 tokens (~95%)

### Code Review Prep
```bash
# Get overview before reviewing
bash scripts/quick_context.sh
bash scripts/test_summary.sh
```

**Token savings**: 15,000 → 800 tokens (~95%)

---

## ⚡ Performance Tips

1. **Use quick_context.sh FIRST** in every session
2. **Batch checks** with analyze_context.sh before reading files
3. **story_analyzer.sh all** gives you ALL stories in one call
4. **Only Read files** when you need specific implementation details

---

## 🎓 Example Conversation

### ❌ Bad (High Token Usage)
```
User: "What stories are in progress?"
Claude: *Reads story 4-1.md* (2000 tokens)
Claude: *Reads story 4-2.md* (2000 tokens)
Claude: *Reads story 4-3.md* (2000 tokens)
Claude: "Stories 4-2 and 4-3 are in progress"
Total: ~6000 tokens
```

### ✅ Good (Low Token Usage)
```
User: "What stories are in progress?"
Claude: *bash scripts/story_analyzer.sh all*
Claude: "Based on analysis: Stories 4-2 (60% done) and 4-3 (30% done) are in progress"
Total: ~500 tokens
```

**Savings**: 92%!

---

## 🔥 Must-Use Scenarios

### Scenario 1: User asks about project status
```bash
bash scripts/quick_context.sh
```
Returns everything in ~300 tokens instead of 10,000+

### Scenario 2: Starting BMAD workflow
```bash
bash scripts/story_analyzer.sh all
bash scripts/analyze_context.sh
```
Get full context in ~1000 tokens instead of 20,000+

### Scenario 3: Checking if feature exists
```bash
bash scripts/check_implementation.sh "<term>" <type>
```
Know instantly without reading files

### Scenario 4: Before making changes
```bash
bash scripts/quick_context.sh
bash scripts/check_implementation.sh "<feature>"
```
Verify state in ~500 tokens instead of 8,000+

---

## 🧠 Decision Tree

```
User makes request
    ↓
Does it need info from multiple files?
    ├── YES → Use script!
    │         └── Which one?
    │             ├── Project overview → quick_context.sh
    │             ├── Story info → story_analyzer.sh
    │             ├── Check feature → check_implementation.sh
    │             ├── Test results → test_summary.sh
    │             └── Full context → analyze_context.sh
    │
    └── NO → Does it need specific line-by-line code?
              ├── YES → Use Read tool
              └── NO → Use script!
```

---

## 📊 Impact Metrics

**Average conversation WITHOUT scripts**:
- Project overview: ~15,000 tokens
- Story analysis: ~8,000 tokens
- Feature check: ~5,000 tokens
- **Total**: ~28,000 tokens

**Same conversation WITH scripts**:
- Project overview: ~500 tokens
- Story analysis: ~600 tokens
- Feature check: ~300 tokens
- **Total**: ~1,400 tokens

**Savings**: ~95% = **26,600 tokens saved** per conversation!

---

## ✨ Pro Tips for Claude Code

1. **Always start with quick_context.sh** - get bearings first
2. **Chain scripts** - use multiple in one bash session
3. **Read files LAST** - only when you need implementation details
4. **Trust the scripts** - they're faster and more accurate than manual searches
5. **Update user** - tell them you're using efficient scripts

---

## 🛑 When NOT to Use Scripts

- User asks for specific code snippet → Use Read
- Need to edit exact lines → Use Read then Edit
- Debugging specific error → Read the error location
- User wants to see full test output → Run tests normally

**Rule**: Scripts for OVERVIEW, Read for DETAILS

---

## 💡 Remember

> "Scripts first, files second"
> "Batch operations, save tokens"
> "Context fast, code slow"

Use these scripts and you'll save 90%+ tokens on every conversation! 🚀
