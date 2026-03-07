# BMAD Method Documentation (Full)

> Complete documentation for AI consumption
> Generated: 2026-03-07
> Repository: https://github.com/bmad-code-org/BMAD-METHOD

<document path="index.md">
The BMad Method (**B**uild **M**ore **A**rchitect **D**reams) is an AI-driven development framework module within the BMad Method Ecosystem that helps you build software through the whole process from ideation and planning all the way through agentic implementation. It provides specialized AI agents, guided workflows, and intelligent planning that adapts to your project's complexity, whether you're fixing a bug or building an enterprise platform.

If you're comfortable working with AI coding assistants like Claude, Cursor, or GitHub Copilot, you're ready to get started.

:::note[🚀 V6 is Here and We're Just Getting Started!]
Skills Architecture, BMad Builder v1, Dev Loop Automation, and so much more in the works. **[Check out the Roadmap →](/roadmap/)**
:::

## New Here? Start with a Tutorial

The fastest way to understand BMad is to try it.

- **[Get Started with BMad](./tutorials/getting-started.md)** — Install and understand how BMad works
- **[Workflow Map](./reference/workflow-map.md)** — Visual overview of BMM phases, workflows, and context management

:::tip[Just Want to Dive In?]
Install BMad and run `/bmad-help` — it will guide you through everything based on your project and installed modules.
:::

## How to Use These Docs

These docs are organized into four sections based on what you're trying to do:

| Section           | Purpose                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Tutorials**     | Learning-oriented. Step-by-step guides that walk you through building something. Start here if you're new. |
| **How-To Guides** | Task-oriented. Practical guides for solving specific problems. "How do I customize an agent?" lives here.  |
| **Explanation**   | Understanding-oriented. Deep dives into concepts and architecture. Read when you want to know *why*.       |
| **Reference**     | Information-oriented. Technical specifications for agents, workflows, and configuration.                   |

## Extend and Customize

Want to expand BMad with your own agents, workflows, or modules? The **[BMad Builder](https://bmad-builder-docs.bmad-method.org/)** provides the framework and tools for creating custom extensions, whether you're adding new capabilities to BMad or building entirely new modules from scratch.

## What You'll Need

BMad works with any AI coding assistant that supports custom system prompts or project context. Popular options include:

- **[Claude Code](https://code.claude.com)** — Anthropic's CLI tool (recommended)
- **[Cursor](https://cursor.sh)** — AI-first code editor
- **[Codex CLI](https://github.com/openai/codex)** — OpenAI's terminal coding agent

You should be comfortable with basic software development concepts like version control, project structure, and agile workflows. No prior experience with BMad-style agent systems is required—that's what these docs are for.

## Join the Community

Get help, share what you're building, or contribute to BMad:

- **[Discord](https://discord.gg/gk8jAdXWmj)** — Chat with other BMad users, ask questions, share ideas
- **[GitHub](https://github.com/bmad-code-org/BMAD-METHOD)** — Source code, issues, and contributions
- **[YouTube](https://www.youtube.com/@BMadCode)** — Video tutorials and walkthroughs

## Next Step

Ready to dive in? **[Get Started with BMad](./tutorials/getting-started.md)** and build your first project.
</document>

<document path="tutorials/getting-started.md">
Build software faster using AI-powered workflows with specialized agents that guide you through planning, architecture, and implementation.

## What You'll Learn

- Install and initialize BMad Method for a new project
- Use **BMad-Help** — your intelligent guide that knows what to do next
- Choose the right planning track for your project size
- Progress through phases from requirements to working code
- Use agents and workflows effectively

:::note[Prerequisites]
- **Node.js 20+** — Required for the installer
- **Git** — Recommended for version control
- **AI-powered IDE** — Claude Code, Cursor, or similar
- **A project idea** — Even a simple one works for learning
:::

:::tip[The Easiest Path]
**Install** → `npx bmad-method install`
**Ask** → `/bmad-help what should I do first?`
**Build** → Let BMad-Help guide you workflow by workflow
:::

## Meet BMad-Help: Your Intelligent Guide

**BMad-Help is the fastest way to get started with BMad.** You don't need to memorize workflows or phases — just ask, and BMad-Help will:

- **Inspect your project** to see what's already been done
- **Show your options** based on which modules you have installed
- **Recommend what's next** — including the first required task
- **Answer questions** like "I have a SaaS idea, where do I start?"

### How to Use BMad-Help

Run it in your AI IDE with just the slash command:

```
/bmad-help
```

Or combine it with a question for context-aware guidance:

```
/bmad-help I have an idea for a SaaS product, I already know all the features I want. where do I get started?
```

BMad-Help will respond with:
- What's recommended for your situation
- What the first required task is
- What the rest of the process looks like

### It Powers Workflows Too

BMad-Help doesn't just answer questions — **it automatically runs at the end of every workflow** to tell you exactly what to do next. No guessing, no searching docs — just clear guidance on the next required workflow.

:::tip[Start Here]
After installing BMad, run `/bmad-help` immediately. It will detect what modules you have installed and guide you to the right starting point for your project.
:::

## Understanding BMad

BMad helps you build software through guided workflows with specialized AI agents. The process follows four phases:

| Phase | Name           | What Happens                                        |
| ----- | -------------- | --------------------------------------------------- |
| 1     | Analysis       | Brainstorming, research, product brief *(optional)* |
| 2     | Planning       | Create requirements (PRD or tech-spec)              |
| 3     | Solutioning    | Design architecture *(BMad Method/Enterprise only)* |
| 4     | Implementation | Build epic by epic, story by story                  |

**[Open the Workflow Map](../reference/workflow-map.md)** to explore phases, workflows, and context management.

Based on your project's complexity, BMad offers three planning tracks:

| Track           | Best For                                               | Documents Created                      |
| --------------- | ------------------------------------------------------ | -------------------------------------- |
| **Quick Flow**  | Bug fixes, simple features, clear scope (1-15 stories) | Tech-spec only                         |
| **BMad Method** | Products, platforms, complex features (10-50+ stories) | PRD + Architecture + UX                |
| **Enterprise**  | Compliance, multi-tenant systems (30+ stories)         | PRD + Architecture + Security + DevOps |

:::note
Story counts are guidance, not definitions. Choose your track based on planning needs, not story math.
:::

## Installation

Open a terminal in your project directory and run:

```bash
npx bmad-method install
```

When prompted to select modules, choose **BMad Method**.

The installer creates two folders:
- `_bmad/` — agents, workflows, tasks, and configuration
- `_bmad-output/` — empty for now, but this is where your artifacts will be saved

:::tip[Your Next Step]
Open your AI IDE in the project folder and run:

```
/bmad-help
```

BMad-Help will detect what you've completed and recommend exactly what to do next. You can also ask it questions like "What are my options?" or "I have a SaaS idea, where should I start?"
:::

:::note[How to Load Agents and Run Workflows]
Each workflow has a **slash command** you run in your IDE (e.g., `/bmad-bmm-create-prd`). Running a workflow command automatically loads the appropriate agent — you don't need to load agents separately. You can also load an agent directly for general conversation (e.g., `/bmad-agent-bmm-pm` for the PM agent).
:::

:::caution[Fresh Chats]
Always start a fresh chat for each workflow. This prevents context limitations from causing issues.
:::

## Step 1: Create Your Plan

Work through phases 1-3. **Use fresh chats for each workflow.**

:::tip[Project Context (Optional)]
Before starting, consider creating `project-context.md` to document your technical preferences and implementation rules. This ensures all AI agents follow your conventions throughout the project.

Create it manually at `_bmad-output/project-context.md` or generate it after architecture using `/bmad-bmm-generate-project-context`. [Learn more](../explanation/project-context.md).
:::

### Phase 1: Analysis (Optional)

All workflows in this phase are optional:
- **brainstorming** (`/bmad-brainstorming`) — Guided ideation
- **research** (`/bmad-bmm-research`) — Market and technical research
- **create-product-brief** (`/bmad-bmm-create-product-brief`) — Recommended foundation document

### Phase 2: Planning (Required)

**For BMad Method and Enterprise tracks:**
1. Load the **PM agent** (`/bmad-agent-bmm-pm`) in a new chat
2. Run the `prd` workflow (`/bmad-bmm-create-prd`)
3. Output: `PRD.md`

**For Quick Flow track:**
- Use the `quick-spec` workflow (`/bmad-bmm-quick-spec`) instead of PRD, then skip to implementation

:::note[UX Design (Optional)]
If your project has a user interface, load the **UX-Designer agent** (`/bmad-agent-bmm-ux-designer`) and run the UX design workflow (`/bmad-bmm-create-ux-design`) after creating your PRD.
:::

### Phase 3: Solutioning (BMad Method/Enterprise)

**Create Architecture**
1. Load the **Architect agent** (`/bmad-agent-bmm-architect`) in a new chat
2. Run `create-architecture` (`/bmad-bmm-create-architecture`)
3. Output: Architecture document with technical decisions

**Create Epics and Stories**

:::tip[V6 Improvement]
Epics and stories are now created *after* architecture. This produces better quality stories because architecture decisions (database, API patterns, tech stack) directly affect how work should be broken down.
:::

1. Load the **PM agent** (`/bmad-agent-bmm-pm`) in a new chat
2. Run `create-epics-and-stories` (`/bmad-bmm-create-epics-and-stories`)
3. The workflow uses both PRD and Architecture to create technically-informed stories

**Implementation Readiness Check** *(Highly Recommended)*
1. Load the **Architect agent** (`/bmad-agent-bmm-architect`) in a new chat
2. Run `check-implementation-readiness` (`/bmad-bmm-check-implementation-readiness`)
3. Validates cohesion across all planning documents

## Step 2: Build Your Project

Once planning is complete, move to implementation. **Each workflow should run in a fresh chat.**

### Initialize Sprint Planning

Load the **SM agent** (`/bmad-agent-bmm-sm`) and run `sprint-planning` (`/bmad-bmm-sprint-planning`). This creates `sprint-status.yaml` to track all epics and stories.

### The Build Cycle

For each story, repeat this cycle with fresh chats:

| Step | Agent | Workflow       | Command                    | Purpose                            |
| ---- | ----- | -------------- | -------------------------- | ---------------------------------- |
| 1    | SM    | `create-story` | `/bmad-bmm-create-story`  | Create story file from epic        |
| 2    | DEV   | `dev-story`    | `/bmad-bmm-dev-story`     | Implement the story                |
| 3    | DEV   | `code-review`  | `/bmad-bmm-code-review`   | Quality validation *(recommended)* |

After completing all stories in an epic, load the **SM agent** (`/bmad-agent-bmm-sm`) and run `retrospective` (`/bmad-bmm-retrospective`).

## What You've Accomplished

You've learned the foundation of building with BMad:

- Installed BMad and configured it for your IDE
- Initialized a project with your chosen planning track
- Created planning documents (PRD, Architecture, Epics & Stories)
- Understood the build cycle for implementation

Your project now has:

```text
your-project/
├── _bmad/                                   # BMad configuration
├── _bmad-output/
│   ├── planning-artifacts/
│   │   ├── PRD.md                           # Your requirements document
│   │   ├── architecture.md                  # Technical decisions
│   │   └── epics/                           # Epic and story files
│   ├── implementation-artifacts/
│   │   └── sprint-status.yaml               # Sprint tracking
│   └── project-context.md                   # Implementation rules (optional)
└── ...
```

## Quick Reference

| Workflow                              | Command                                    | Agent     | Purpose                                         |
| ------------------------------------- | ------------------------------------------ | --------- | ----------------------------------------------- |
| **`help`** ⭐                         | `/bmad-help`                               | Any       | **Your intelligent guide — ask anything!**      |
| `prd`                                 | `/bmad-bmm-create-prd`                     | PM        | Create Product Requirements Document            |
| `create-architecture`                 | `/bmad-bmm-create-architecture`            | Architect | Create architecture document                     |
| `generate-project-context`            | `/bmad-bmm-generate-project-context`       | Analyst   | Create project context file                     |
| `create-epics-and-stories`       | `/bmad-bmm-create-epics-and-stories`       | PM        | Break down PRD into epics            |
| `check-implementation-readiness` | `/bmad-bmm-check-implementation-readiness` | Architect | Validate planning cohesion           |
| `sprint-planning`                | `/bmad-bmm-sprint-planning`                | SM        | Initialize sprint tracking           |
| `create-story`                   | `/bmad-bmm-create-story`                   | SM        | Create a story file                  |
| `dev-story`                      | `/bmad-bmm-dev-story`                      | DEV       | Implement a story                    |
| `code-review`                    | `/bmad-bmm-code-review`                    | DEV       | Review implemented code              |

## Common Questions

**Do I always need architecture?**
Only for BMad Method and Enterprise tracks. Quick Flow skips from tech-spec to implementation.

**Can I change my plan later?**
Yes. The SM agent has a `correct-course` workflow (`/bmad-bmm-correct-course`) for handling scope changes.

**What if I want to brainstorm first?**
Load the Analyst agent (`/bmad-agent-bmm-analyst`) and run `brainstorming` (`/bmad-brainstorming`) before starting your PRD.

**Do I need to follow a strict order?**
Not strictly. Once you learn the flow, you can run workflows directly using the Quick Reference above.

## Getting Help

:::tip[First Stop: BMad-Help]
**Run `/bmad-help` anytime** — it's the fastest way to get unstuck. Ask it anything:
- "What should I do after installing?"
- "I'm stuck on workflow X"
- "What are my options for Y?"
- "Show me what's been done so far"

BMad-Help inspects your project, detects what you've completed, and tells you exactly what to do next.
:::

- **During workflows** — Agents guide you with questions and explanations
- **Community** — [Discord](https://discord.gg/gk8jAdXWmj) (#bmad-method-help, #report-bugs-and-issues)

## Key Takeaways

:::tip[Remember These]
- **Start with `/bmad-help`** — Your intelligent guide that knows your project and options
- **Always use fresh chats** — Start a new chat for each workflow
- **Track matters** — Quick Flow uses quick-spec; Method/Enterprise need PRD and architecture
- **BMad-Help runs automatically** — Every workflow ends with guidance on what's next
:::

Ready to start? Install BMad, run `/bmad-help`, and let your intelligent guide lead the way.
</document>

<document path="how-to/customize-bmad.md">
Use the `.customize.yaml` files to tailor agent behavior, personas, and menus while preserving your changes across updates.

## When to Use This

- You want to change an agent's name, personality, or communication style
- You need agents to remember project-specific context
- You want to add custom menu items that trigger your own workflows or prompts
- You want agents to perform specific actions every time they start up

:::note[Prerequisites]
- BMad installed in your project (see [How to Install BMad](./install-bmad.md))
- A text editor for YAML files
:::

:::caution[Keep Your Customizations Safe]
Always use the `.customize.yaml` files described here rather than editing agent files directly. The installer overwrites agent files during updates, but preserves your `.customize.yaml` changes.
:::

## Steps

### 1. Locate Customization Files

After installation, find one `.customize.yaml` file per agent in:

```text
_bmad/_config/agents/
├── core-bmad-master.customize.yaml
├── bmm-dev.customize.yaml
├── bmm-pm.customize.yaml
└── ... (one file per installed agent)
```

### 2. Edit the Customization File

Open the `.customize.yaml` file for the agent you want to modify. Every section is optional -- customize only what you need.

| Section            | Behavior | Purpose                                         |
| ------------------ | -------- | ----------------------------------------------- |
| `agent.metadata`   | Replaces | Override the agent's display name               |
| `persona`          | Replaces | Set role, identity, style, and principles       |
| `memories`         | Appends  | Add persistent context the agent always recalls |
| `menu`             | Appends  | Add custom menu items for workflows or prompts  |
| `critical_actions` | Appends  | Define startup instructions for the agent       |
| `prompts`          | Appends  | Create reusable prompts for menu actions        |

Sections marked **Replaces** overwrite the agent's defaults entirely. Sections marked **Appends** add to the existing configuration.

**Agent Name**

Change how the agent introduces itself:

```yaml
agent:
  metadata:
    name: 'Spongebob' # Default: "Amelia"
```

**Persona**

Replace the agent's personality, role, and communication style:

```yaml
persona:
  role: 'Senior Full-Stack Engineer'
  identity: 'Lives in a pineapple (under the sea)'
  communication_style: 'Spongebob annoying'
  principles:
    - 'Never Nester, Spongebob Devs hate nesting more than 2 levels deep'
    - 'Favor composition over inheritance'
```

The `persona` section replaces the entire default persona, so include all four fields if you set it.

**Memories**

Add persistent context the agent will always remember:

```yaml
memories:
  - 'Works at Krusty Krab'
  - 'Favorite Celebrity: David Hasslehoff'
  - 'Learned in Epic 1 that it is not cool to just pretend that tests have passed'
```

**Menu Items**

Add custom entries to the agent's display menu. Each item needs a `trigger`, a target (`workflow` path or `action` reference), and a `description`:

```yaml
menu:
  - trigger: my-workflow
    workflow: 'my-custom/workflows/my-workflow.yaml'
    description: My custom workflow
  - trigger: deploy
    action: '#deploy-prompt'
    description: Deploy to production
```

**Critical Actions**

Define instructions that run when the agent starts up:

```yaml
critical_actions:
  - 'Check the CI Pipelines with the XYZ Skill and alert user on wake if anything is urgently needing attention'
```

**Custom Prompts**

Create reusable prompts that menu items can reference with `action="#id"`:

```yaml
prompts:
  - id: deploy-prompt
    content: |
      Deploy the current branch to production:
      1. Run all tests
      2. Build the project
      3. Execute deployment script
```

### 3. Apply Your Changes

After editing, recompile the agent to apply changes:

```bash
npx bmad-method install
```

The installer detects the existing installation and offers these options:

| Option                       | What It Does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| **Quick Update**             | Updates all modules to the latest version and recompiles all agents |
| **Recompile Agents**         | Applies customizations only, without updating module files          |
| **Modify BMad Installation** | Full installation flow for adding or removing modules               |

For customization-only changes, **Recompile Agents** is the fastest option.

## Troubleshooting

**Changes not appearing?**

- Run `npx bmad-method install` and select **Recompile Agents** to apply changes
- Check that your YAML syntax is valid (indentation matters)
- Verify you edited the correct `.customize.yaml` file for the agent

**Agent not loading?**

- Check for YAML syntax errors using an online YAML validator
- Ensure you did not leave fields empty after uncommenting them
- Try reverting to the original template and rebuilding

**Need to reset an agent?**

- Clear or delete the agent's `.customize.yaml` file
- Run `npx bmad-method install` and select **Recompile Agents** to restore defaults

## Workflow Customization

Customization of existing BMad Method workflows and skills is coming soon.

## Module Customization

Guidance on building expansion modules and customizing existing modules is coming soon.
</document>

<document path="how-to/established-projects.md">
Use BMad Method effectively when working on existing projects and legacy codebases.

This guide covers the essential workflow for onboarding to existing projects with BMad Method.

:::note[Prerequisites]
- BMad Method installed (`npx bmad-method install`)
- An existing codebase you want to work on
- Access to an AI-powered IDE (Claude Code or Cursor)
:::

## Step 1: Clean Up Completed Planning Artifacts

If you have completed all PRD epics and stories through the BMad process, clean up those files. Archive them, delete them, or rely on version history if needed. Do not keep these files in:

- `docs/`
- `_bmad-output/planning-artifacts/`
- `_bmad-output/implementation-artifacts/`

## Step 2: Create Project Context

:::tip[Recommended for Existing Projects]
Generate `project-context.md` to capture your existing codebase patterns and conventions. This ensures AI agents follow your established practices when implementing changes.
:::

Run the generate project context workflow:

```bash
/bmad-bmm-generate-project-context
```

This scans your codebase to identify:
- Technology stack and versions
- Code organization patterns
- Naming conventions
- Testing approaches
- Framework-specific patterns

You can review and refine the generated file, or create it manually at `_bmad-output/project-context.md` if you prefer.

[Learn more about project context](../explanation/project-context.md)

## Step 3: Maintain Quality Project Documentation

Your `docs/` folder should contain succinct, well-organized documentation that accurately represents your project:

- Intent and business rationale
- Business rules
- Architecture
- Any other relevant project information

For complex projects, consider using the `document-project` workflow. It offers runtime variants that will scan your entire project and document its actual current state.

## Step 3: Get Help

### BMad-Help: Your Starting Point

**Run `/bmad-help` anytime you're unsure what to do next.** This intelligent guide:

- Inspects your project to see what's already been done
- Shows options based on your installed modules
- Understands natural language queries

```
/bmad-help I have an existing Rails app, where should I start?
/bmad-help What's the difference between quick-flow and full method?
/bmad-help Show me what workflows are available
```

BMad-Help also **automatically runs at the end of every workflow**, providing clear guidance on exactly what to do next.

### Choosing Your Approach

You have two primary options depending on the scope of changes:

| Scope                          | Recommended Approach                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Small updates or additions** | Use `quick-flow-solo-dev` to create a tech-spec and implement the change. The full four-phase BMad Method is likely overkill. |
| **Major changes or additions** | Start with the BMad Method, applying as much or as little rigor as needed.                                                    |

### During PRD Creation

When creating a brief or jumping directly into the PRD, ensure the agent:

- Finds and analyzes your existing project documentation
- Reads the proper context about your current system

You can guide the agent explicitly, but the goal is to ensure the new feature integrates well with your existing system.

### UX Considerations

UX work is optional. The decision depends not on whether your project has a UX, but on:

- Whether you will be working on UX changes
- Whether significant new UX designs or patterns are needed

If your changes amount to simple updates to existing screens you are happy with, a full UX process is unnecessary.

### Architecture Considerations

When doing architecture, ensure the architect:

- Uses the proper documented files
- Scans the existing codebase

Pay close attention here to prevent reinventing the wheel or making decisions that misalign with your existing architecture.

## More Information

- **[Quick Fixes](./quick-fixes.md)** - Bug fixes and ad-hoc changes
- **[Established Projects FAQ](../explanation/established-projects-faq.md)** - Common questions about working on established projects
</document>

<document path="how-to/get-answers-about-bmad.md">
## Start Here: BMad-Help

**The fastest way to get answers about BMad is `/bmad-help`.** This intelligent guide will answer upwards of 80% of all questions and is available to you directly in your IDE as you work.

BMad-Help is more than a lookup tool — it:
- **Inspects your project** to see what's already been completed
- **Understands natural language** — ask questions in plain English
- **Varies based on your installed modules** — shows relevant options
- **Auto-runs after workflows** — tells you exactly what to do next
- **Recommends the first required task** — no guessing where to start

### How to Use BMad-Help

Run it with just the slash command:

```
/bmad-help
```

Or combine it with a natural language query:

```
/bmad-help I have a SaaS idea and know all the features. Where do I start?
/bmad-help What are my options for UX design?
/bmad-help I'm stuck on the PRD workflow
/bmad-help Show me what's been done so far
```

BMad-Help responds with:
- What's recommended for your situation
- What the first required task is
- What the rest of the process looks like

---

## When to Use This Guide

Use this section when:
- You want to understand BMad's architecture or internals
- You need answers outside of what BMad-Help provides
- You're researching BMad before installing
- You want to explore the source code directly

## Steps

### 1. Choose Your Source

| Source               | Best For                                  | Examples                     |
| -------------------- | ----------------------------------------- | ---------------------------- |
| **`_bmad` folder**   | How BMad works—agents, workflows, prompts | "What does the PM agent do?" |
| **Full GitHub repo** | History, installer, architecture          | "What changed in v6?"        |
| **`llms-full.txt`**  | Quick overview from docs                  | "Explain BMad's four phases" |

The `_bmad` folder is created when you install BMad. If you don't have it yet, clone the repo instead.

### 2. Point Your AI at the Source

**If your AI can read files (Claude Code, Cursor, etc.):**

- **BMad installed:** Point at the `_bmad` folder and ask directly
- **Want deeper context:** Clone the [full repo](https://github.com/bmad-code-org/BMAD-METHOD)

**If you use ChatGPT or Claude.ai:**

Fetch `llms-full.txt` into your session:

```text
https://bmad-code-org.github.io/BMAD-METHOD/llms-full.txt
```


### 3. Ask Your Question

:::note[Example]
**Q:** "Tell me the fastest way to build something with BMad"

**A:** Use Quick Flow: Run `quick-spec` to write a technical specification, then `quick-dev` to implement it—skipping the full planning phases.
:::

## What You Get

Direct answers about BMad—how agents work, what workflows do, why things are structured the way they are—without waiting for someone else to respond.

## Tips

- **Verify surprising answers** — LLMs occasionally get things wrong. Check the source file or ask on Discord.
- **Be specific** — "What does step 3 of the PRD workflow do?" beats "How does PRD work?"

## Still Stuck?

Tried the LLM approach and still need help? You now have a much better question to ask.

| Channel                   | Use For                                     |
| ------------------------- | ------------------------------------------- |
| `#bmad-method-help`       | Quick questions (real-time chat)            |
| `help-requests` forum     | Detailed questions (searchable, persistent) |
| `#suggestions-feedback`   | Ideas and feature requests                  |
| `#report-bugs-and-issues` | Bug reports                                 |

**Discord:** [discord.gg/gk8jAdXWmj](https://discord.gg/gk8jAdXWmj)

**GitHub Issues:** [github.com/bmad-code-org/BMAD-METHOD/issues](https://github.com/bmad-code-org/BMAD-METHOD/issues) (for clear bugs)

*You!*
        *Stuck*
             *in the queue—*
                      *waiting*
                              *for who?*

*The source*
        *is there,*
                *plain to see!*

*Point*
     *your machine.*
              *Set it free.*

*It reads.*
        *It speaks.*
                *Ask away—*

*Why wait*
        *for tomorrow*
                *when you have*
                        *today?*

*—Claude*
</document>

<document path="how-to/install-bmad.md">
Use the `npx bmad-method install` command to set up BMad in your project with your choice of modules and AI tools.

If you want to use a non interactive installer and provide all install options on the command line, see [this guide](./non-interactive-installation.md).

## When to Use This

- Starting a new project with BMad
- Adding BMad to an existing codebase
- Update the existing BMad Installation

:::note[Prerequisites]
- **Node.js** 20+ (required for the installer)
- **Git** (recommended)
- **AI tool** (Claude Code, Cursor, or similar)
:::

## Steps

### 1. Run the Installer

```bash
npx bmad-method install
```

:::tip[Bleeding edge]
To install the latest from the main branch (may be unstable):
```bash
npx github:bmad-code-org/BMAD-METHOD install
```
:::

### 2. Choose Installation Location

The installer will ask where to install BMad files:

- Current directory (recommended for new projects if you created the directory yourself and ran from within the directory)
- Custom path

### 3. Select Your AI Tools

Pick which AI tools you use:

- Claude Code
- Cursor
- Others

Each tool has its own way of integrating commands. The installer creates tiny prompt files to activate workflows and agents — it just puts them where your tool expects to find them.

### 4. Choose Modules

The installer shows available modules. Select whichever ones you need — most users just want **BMad Method** (the software development module).

### 5. Follow the Prompts

The installer guides you through the rest — custom content, settings, etc.

## What You Get

```text
your-project/
├── _bmad/
│   ├── bmm/            # Your selected modules
│   │   └── config.yaml # Module settings (if you ever need to change them)
│   ├── core/           # Required core module
│   └── ...
├── _bmad-output/       # Generated artifacts
├── .claude/            # Claude Code commands (if using Claude Code)
└── .kiro/              # Kiro steering files (if using Kiro)
```

## Verify Installation

Run `/bmad-help` to verify everything works and see what to do next.

**BMad-Help is your intelligent guide** that will:
- Confirm your installation is working
- Show what's available based on your installed modules
- Recommend your first step

You can also ask it questions:
```
/bmad-help I just installed, what should I do first?
/bmad-help What are my options for a SaaS project?
```

## Troubleshooting

**Installer throws an error** — Copy-paste the output into your AI assistant and let it figure it out.

**Installer worked but something doesn't work later** — Your AI needs BMad context to help. See [How to Get Answers About BMad](./get-answers-about-bmad.md) for how to point your AI at the right sources.
</document>

<document path="how-to/non-interactive-installation.md">
Use command-line flags to install BMad non-interactively. This is useful for:

## When to Use This

- Automated deployments and CI/CD pipelines
- Scripted installations
- Batch installations across multiple projects
- Quick installations with known configurations

:::note[Prerequisites]
Requires [Node.js](https://nodejs.org) v20+ and `npx` (included with npm).
:::

## Available Flags

### Installation Options

| Flag | Description | Example |
|------|-------------|---------|
| `--directory <path>` | Installation directory | `--directory ~/projects/myapp` |
| `--modules <modules>` | Comma-separated module IDs | `--modules bmm,bmb` |
| `--tools <tools>` | Comma-separated tool/IDE IDs (use `none` to skip) | `--tools claude-code,cursor` or `--tools none` |
| `--custom-content <paths>` | Comma-separated paths to custom modules | `--custom-content ~/my-module,~/another-module` |
| `--action <type>` | Action for existing installations: `install` (default), `update`, `quick-update`, or `compile-agents` | `--action quick-update` |

### Core Configuration

| Flag | Description | Default |
|------|-------------|---------|
| `--user-name <name>` | Name for agents to use | System username |
| `--communication-language <lang>` | Agent communication language | English |
| `--document-output-language <lang>` | Document output language | English |
| `--output-folder <path>` | Output folder path | _bmad-output |

### Other Options

| Flag | Description |
|------|-------------|
| `-y, --yes` | Accept all defaults and skip prompts |
| `-d, --debug` | Enable debug output for manifest generation |

## Module IDs

Available module IDs for the `--modules` flag:

- `bmm` — BMad Method Master
- `bmb` — BMad Builder

Check the [BMad registry](https://github.com/bmad-code-org) for available external modules.

## Tool/IDE IDs

Available tool IDs for the `--tools` flag:

**Preferred:** `claude-code`, `cursor`

Run `npx bmad-method install` interactively once to see the full current list of supported tools, or check the [platform codes configuration](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/tools/cli/installers/lib/ide/platform-codes.yaml).

## Installation Modes

| Mode | Description | Example |
|------|-------------|---------|
| Fully non-interactive | Provide all flags to skip all prompts | `npx bmad-method install --directory . --modules bmm --tools claude-code --yes` |
| Semi-interactive | Provide some flags; BMad prompts for the rest | `npx bmad-method install --directory . --modules bmm` |
| Defaults only | Accept all defaults with `-y` | `npx bmad-method install --yes` |
| Without tools | Skip tool/IDE configuration | `npx bmad-method install --modules bmm --tools none` |

## Examples

### CI/CD Pipeline Installation

```bash
#!/bin/bash
# install-bmad.sh

npx bmad-method install \
  --directory "${GITHUB_WORKSPACE}" \
  --modules bmm \
  --tools claude-code \
  --user-name "CI Bot" \
  --communication-language English \
  --document-output-language English \
  --output-folder _bmad-output \
  --yes
```

### Update Existing Installation

```bash
npx bmad-method install \
  --directory ~/projects/myapp \
  --action update \
  --modules bmm,bmb,custom-module
```

### Quick Update (Preserve Settings)

```bash
npx bmad-method install \
  --directory ~/projects/myapp \
  --action quick-update
```

### Installation with Custom Content

```bash
npx bmad-method install \
  --directory ~/projects/myapp \
  --modules bmm \
  --custom-content ~/my-custom-module,~/another-module \
  --tools claude-code
```

## What You Get

- A fully configured `_bmad/` directory in your project
- Compiled agents and workflows for your selected modules and tools
- A `_bmad-output/` folder for generated artifacts

## Validation and Error Handling

BMad validates all provided flags:

- **Directory** — Must be a valid path with write permissions
- **Modules** — Warns about invalid module IDs (but won't fail)
- **Tools** — Warns about invalid tool IDs (but won't fail)
- **Custom Content** — Each path must contain a valid `module.yaml` file
- **Action** — Must be one of: `install`, `update`, `quick-update`, `compile-agents`

Invalid values will either:
1. Show an error and exit (for critical options like directory)
2. Show a warning and skip (for optional items like custom content)
3. Fall back to interactive prompts (for missing required values)

:::tip[Best Practices]
- Use absolute paths for `--directory` to avoid ambiguity
- Test flags locally before using in CI/CD pipelines
- Combine with `-y` for truly unattended installations
- Use `--debug` if you encounter issues during installation
:::

## Troubleshooting

### Installation fails with "Invalid directory"

- The directory path must exist (or its parent must exist)
- You need write permissions
- The path must be absolute or correctly relative to the current directory

### Module not found

- Verify the module ID is correct
- External modules must be available in the registry

### Custom content path invalid

Ensure each custom content path:
- Points to a directory
- Contains a `module.yaml` file in the root
- Has a `code` field in the `module.yaml`

:::note[Still stuck?]
Run with `--debug` for detailed output, try interactive mode to isolate the issue, or report at <https://github.com/bmad-code-org/BMAD-METHOD/issues>.
:::
</document>

<document path="how-to/project-context.md">
Use the `project-context.md` file to ensure AI agents follow your project's technical preferences and implementation rules throughout all workflows.

:::note[Prerequisites]
- BMad Method installed
- Understanding of your project's technology stack and conventions
:::

## When to Use This

- You have strong technical preferences before starting architecture
- You've completed architecture and want to capture decisions for implementation
- You're working on an existing codebase with established patterns
- You notice agents making inconsistent decisions across stories

## Step 1: Choose Your Approach

**Manual creation** — Best when you know exactly what rules you want to document

**Generate after architecture** — Best for capturing decisions made during solutioning

**Generate for existing projects** — Best for discovering patterns in existing codebases

## Step 2: Create the File

### Option A: Manual Creation

Create the file at `_bmad-output/project-context.md`:

```bash
mkdir -p _bmad-output
touch _bmad-output/project-context.md
```

Add your technology stack and implementation rules:

```markdown
---
project_name: 'MyProject'
user_name: 'YourName'
date: '2026-02-15'
sections_completed: ['technology_stack', 'critical_rules']
---

# Project Context for AI Agents

## Technology Stack & Versions

- Node.js 20.x, TypeScript 5.3, React 18.2
- State: Zustand
- Testing: Vitest, Playwright
- Styling: Tailwind CSS

## Critical Implementation Rules

**TypeScript:**
- Strict mode enabled, no `any` types
- Use `interface` for public APIs, `type` for unions

**Code Organization:**
- Components in `/src/components/` with co-located tests
- API calls use `apiClient` singleton — never fetch directly

**Testing:**
- Unit tests focus on business logic
- Integration tests use MSW for API mocking
```

### Option B: Generate After Architecture

Run the workflow in a fresh chat:

```bash
/bmad-bmm-generate-project-context
```

The workflow scans your architecture document and project files to generate a context file capturing the decisions made.

### Option C: Generate for Existing Projects

For existing projects, run:

```bash
/bmad-bmm-generate-project-context
```

The workflow analyzes your codebase to identify conventions, then generates a context file you can review and refine.

## Step 3: Verify Content

Review the generated file and ensure it captures:

- Correct technology versions
- Your actual conventions (not generic best practices)
- Rules that prevent common mistakes
- Framework-specific patterns

Edit manually to add anything missing or remove inaccuracies.

## What You Get

A `project-context.md` file that:

- Ensures all agents follow the same conventions
- Prevents inconsistent decisions across stories
- Captures architecture decisions for implementation
- Serves as a reference for your project's patterns and rules

## Tips

:::tip[Focus on the Unobvious]
Document patterns agents might miss such as "Use JSDoc style comments on every public class, function and variable", not universal practices like "use meaningful variable names" which LLMs know at this point.
:::

:::tip[Keep It Lean]
This file is loaded by every implementation workflow. Long files waste context. Do not include content that only applies to narrow scope or specific stories or features.
:::

:::tip[Update as Needed]
Edit manually when patterns change, or re-generate after significant architecture changes.
:::

:::tip[Works for All Project Types]
Just as useful for Quick Flow as for full BMad Method projects.
:::

## Next Steps

- [**Project Context Explanation**](../explanation/project-context.md) — Learn more about how it works
- [**Workflow Map**](../reference/workflow-map.md) — See which workflows load project context
</document>

<document path="how-to/quick-fixes.md">
Use the **DEV agent** directly for bug fixes, refactorings, or small targeted changes that don't require the full BMad Method or Quick Flow.

## When to Use This

- Bug fixes with a clear, known cause
- Small refactorings (rename, extract, restructure) contained within a few files
- Minor feature tweaks or configuration changes
- Exploratory work to understand an unfamiliar codebase

:::note[Prerequisites]
- BMad Method installed (`npx bmad-method install`)
- An AI-powered IDE (Claude Code, Cursor, or similar)
:::

## Choose Your Approach

| Situation | Agent | Why |
| --- | --- | --- |
| Fix a specific bug or make a small, scoped change | **DEV agent** | Jumps straight into implementation without planning overhead |
| Change touches several files or you want a written plan first | **Quick Flow Solo Dev** | Creates a quick-spec before implementation so the agent stays aligned to your standards |

If you are unsure, start with the DEV agent. You can always escalate to Quick Flow if the change grows.

## Steps

### 1. Load the DEV Agent

Start a **fresh chat** in your AI IDE and load the DEV agent with its slash command:

```text
/bmad-agent-bmm-dev
```

This loads the agent's persona and capabilities into the session. If you decide you need Quick Flow instead, load the **Quick Flow Solo Dev** agent in a fresh chat:

```text
/bmad-agent-bmm-quick-flow-solo-dev
```

Once the Solo Dev agent is loaded, describe your change and ask it to create a **quick-spec**. The agent drafts a lightweight spec capturing what you want to change and how. After you approve the quick-spec, tell the agent to start the **Quick Flow dev cycle** -- it will implement the change, run tests, and perform a self-review, all guided by the spec you just approved.

:::tip[Fresh Chats]
Always start a new chat session when loading an agent. Reusing a session from a previous workflow can cause context conflicts.
:::

### 2. Describe the Change

Tell the agent what you need in plain language. Be specific about the problem and, if you know it, where the relevant code lives.

:::note[Example Prompts]
**Bug fix** -- "Fix the login validation bug that allows empty passwords. The validation logic is in `src/auth/validate.ts`."

**Refactoring** -- "Refactor the UserService to use async/await instead of callbacks."

**Configuration change** -- "Update the CI pipeline to cache node_modules between runs."

**Dependency update** -- "Upgrade the express dependency to the latest v5 release and fix any breaking changes."
:::

You don't need to provide every detail. The agent will read the relevant source files and ask clarifying questions when needed.

### 3. Let the Agent Work

The agent will:

- Read and analyze the relevant source files
- Propose a solution and explain its reasoning
- Implement the change across the affected files
- Run your project's test suite if one exists

If your project has tests, the agent runs them automatically after making changes and iterates until tests pass. For projects without a test suite, verify the change manually (run the app, hit the endpoint, check the output).

### 4. Review and Verify

Before committing, review what changed:

- Read through the diff to confirm the change matches your intent
- Run the application or tests yourself to double-check
- If something looks wrong, tell the agent what to fix -- it can iterate in the same session

Once satisfied, commit the changes with a clear message describing the fix.

:::caution[If Something Breaks]
If a committed change causes unexpected issues, use `git revert HEAD` to undo the last commit cleanly. Then start a fresh chat with the DEV agent to try a different approach.
:::

## Learning Your Codebase

The DEV agent is also useful for exploring unfamiliar code. Load it in a fresh chat and ask questions:

:::note[Example Prompts]
"Explain how the authentication system works in this codebase."

"Show me where error handling happens in the API layer."

"What does the `ProcessOrder` function do and what calls it?"
:::

Use the agent to learn about your project, understand how components connect, and explore unfamiliar areas before making changes.

## What You Get

- Modified source files with the fix or refactoring applied
- Passing tests (if your project has a test suite)
- A clean commit describing the change

No planning artifacts are produced -- that's the point of this approach.

## When to Upgrade to Formal Planning

Consider using [Quick Flow](../explanation/quick-flow.md) or the full BMad Method when:

- The change affects multiple systems or requires coordinated updates across many files
- You are unsure about the scope and need a spec to think it through
- The fix keeps growing in complexity as you work on it
- You need documentation or architectural decisions recorded for the team
</document>

<document path="how-to/shard-large-documents.md">
Use the `shard-doc` tool if you need to split large markdown files into smaller, organized files for better context management.

:::caution[Deprecated]
This is no longer recommended, and soon with updated workflows and most major LLMs and tools supporting subprocesses this will be unnecessary.
:::

## When to Use This

Only use this if you notice your chosen tool / model combination is failing to load and read all the documents as input when needed.

## What is Document Sharding?

Document sharding splits large markdown files into smaller, organized files based on level 2 headings (`## Heading`).

### Architecture

```text
Before Sharding:
_bmad-output/planning-artifacts/
└── PRD.md (large 50k token file)

After Sharding:
_bmad-output/planning-artifacts/
└── prd/
    ├── index.md                    # Table of contents with descriptions
    ├── overview.md                 # Section 1
    ├── user-requirements.md        # Section 2
    ├── technical-requirements.md   # Section 3
    └── ...                         # Additional sections
```

## Steps

### 1. Run the Shard-Doc Tool

```bash
/bmad-shard-doc
```

### 2. Follow the Interactive Process

```text
Agent: Which document would you like to shard?
User: docs/PRD.md

Agent: Default destination: docs/prd/
       Accept default? [y/n]
User: y

Agent: Sharding PRD.md...
       ✓ Created 12 section files
       ✓ Generated index.md
       ✓ Complete!
```

## How Workflow Discovery Works

BMad workflows use a **dual discovery system**:

1. **Try whole document first** - Look for `document-name.md`
2. **Check for sharded version** - Look for `document-name/index.md`
3. **Priority rule** - Whole document takes precedence if both exist - remove the whole document if you want the sharded to be used instead

## Workflow Support

All BMM workflows support both formats:

- Whole documents
- Sharded documents
- Automatic detection
- Transparent to user
</document>

<document path="how-to/upgrade-to-v6.md">
Use the BMad installer to upgrade from v4 to v6, which includes automatic detection of legacy installations and migration assistance.

## When to Use This

- You have BMad v4 installed (`.bmad-method` folder)
- You want to migrate to the new v6 architecture
- You have existing planning artifacts to preserve

:::note[Prerequisites]
- Node.js 20+
- Existing BMad v4 installation
:::

## Steps

### 1. Run the Installer

Follow the [Installer Instructions](./install-bmad.md).

### 2. Handle Legacy Installation

When v4 is detected, you can:

- Allow the installer to back up and remove `.bmad-method`
- Exit and handle cleanup manually

If you named your bmad method folder something else - you will need to manually remove the folder yourself.

### 3. Clean Up IDE Commands

Manually remove legacy v4 IDE commands - for example if you have claude, look for any nested folders that start with bmad and remove them:

- `.claude/commands/BMad/agents`
- `.claude/commands/BMad/tasks`

### 4. Migrate Planning Artifacts

**If you have planning documents (Brief/PRD/UX/Architecture):**

Move them to `_bmad-output/planning-artifacts/` with descriptive names:

- Include `PRD` in filename for PRD documents
- Include `brief`, `architecture`, or `ux-design` accordingly
- Sharded documents can be in named subfolders

**If you're mid-planning:** Consider restarting with v6 workflows. Use your existing documents as inputs—the new progressive discovery workflows with web search and IDE plan mode produce better results.

### 5. Migrate In-Progress Development

If you have stories created or implemented:

1. Complete the v6 installation
2. Place `epics.md` or `epics/epic*.md` in `_bmad-output/planning-artifacts/`
3. Run the Scrum Master's `sprint-planning` workflow
4. Tell the SM which epics/stories are already complete

## What You Get

**v6 unified structure:**

```text
your-project/
├── _bmad/               # Single installation folder
│   ├── _config/         # Your customizations
│   │   └── agents/      # Agent customization files
│   ├── core/            # Universal core framework
│   ├── bmm/             # BMad Method module
│   ├── bmb/             # BMad Builder
│   └── cis/             # Creative Intelligence Suite
└── _bmad-output/        # Output folder (was doc folder in v4)
```

## Module Migration

| v4 Module                     | v6 Status                                 |
| ----------------------------- | ----------------------------------------- |
| `.bmad-2d-phaser-game-dev`    | Integrated into BMGD Module               |
| `.bmad-2d-unity-game-dev`     | Integrated into BMGD Module               |
| `.bmad-godot-game-dev`        | Integrated into BMGD Module               |
| `.bmad-infrastructure-devops` | Deprecated — new DevOps agent coming soon |
| `.bmad-creative-writing`      | Not adapted — new v6 module coming soon   |

## Key Changes

| Concept       | v4                                    | v6                                   |
| ------------- | ------------------------------------- | ------------------------------------ |
| **Core**      | `_bmad-core` was actually BMad Method | `_bmad/core/` is universal framework |
| **Method**    | `_bmad-method`                        | `_bmad/bmm/`                         |
| **Config**    | Modified files directly               | `config.yaml` per module             |
| **Documents** | Sharded or unsharded required setup   | Fully flexible, auto-scanned         |
</document>

<document path="explanation/advanced-elicitation.md">
Make the LLM reconsider what it just generated. You pick a reasoning method, it applies that method to its own output, you decide whether to keep the improvements.

## What is Advanced Elicitation?

A structured second pass. Instead of asking the AI to "try again" or "make it better," you select a specific reasoning method and the AI re-examines its own output through that lens.

The difference matters. Vague requests produce vague revisions. A named method forces a particular angle of attack, surfacing insights that a generic retry would miss.

## When to Use It

- After a workflow generates content and you want alternatives
- When output seems okay but you suspect there's more depth
- To stress-test assumptions or find weaknesses
- For high-stakes content where rethinking helps

Workflows offer advanced elicitation at decision points - after the LLM has generated something, you'll be asked if you want to run it.

## How It Works

1. LLM suggests 5 relevant methods for your content
2. You pick one (or reshuffle for different options)
3. Method is applied, improvements shown
4. Accept or discard, repeat or continue

## Built-in Methods

Dozens of reasoning methods are available. A few examples:

- **Pre-mortem Analysis** - Assume the project already failed, work backward to find why
- **First Principles Thinking** - Strip away assumptions, rebuild from ground truth
- **Inversion** - Ask how to guarantee failure, then avoid those things
- **Red Team vs Blue Team** - Attack your own work, then defend it
- **Socratic Questioning** - Challenge every claim with "why?" and "how do you know?"
- **Constraint Removal** - Drop all constraints, see what changes, add them back selectively
- **Stakeholder Mapping** - Re-evaluate from each stakeholder's perspective
- **Analogical Reasoning** - Find parallels in other domains and apply their lessons

And many more. The AI picks the most relevant options for your content - you choose which to run.

:::tip[Start Here]
Pre-mortem Analysis is a good first pick for any spec or plan. It consistently finds gaps that a standard review misses.
:::
</document>

<document path="explanation/adversarial-review.md">
Force deeper analysis by requiring problems to be found.

## What is Adversarial Review?

A review technique where the reviewer *must* find issues. No "looks good" allowed. The reviewer adopts a cynical stance - assume problems exist and find them.

This isn't about being negative. It's about forcing genuine analysis instead of a cursory glance that rubber-stamps whatever was submitted.

**The core rule:** You must find issues. Zero findings triggers a halt - re-analyze or explain why.

## Why It Works

Normal reviews suffer from confirmation bias. You skim the work, nothing jumps out, you approve it. The "find problems" mandate breaks this pattern:

- **Forces thoroughness** - Can't approve until you've looked hard enough to find issues
- **Catches missing things** - "What's not here?" becomes a natural question
- **Improves signal quality** - Findings are specific and actionable, not vague concerns
- **Information asymmetry** - Run reviews with fresh context (no access to original reasoning) so you evaluate the artifact, not the intent

## Where It's Used

Adversarial review appears throughout BMad workflows - code review, implementation readiness checks, spec validation, and others. Sometimes it's a required step, sometimes optional (like advanced elicitation or party mode). The pattern adapts to whatever artifact needs scrutiny.

## Human Filtering Required

Because the AI is *instructed* to find problems, it will find problems - even when they don't exist. Expect false positives: nitpicks dressed as issues, misunderstandings of intent, or outright hallucinated concerns.

**You decide what's real.** Review each finding, dismiss the noise, fix what matters.

## Example

Instead of:

> "The authentication implementation looks reasonable. Approved."

An adversarial review produces:

> 1. **HIGH** - `login.ts:47` - No rate limiting on failed attempts
> 2. **HIGH** - Session token stored in localStorage (XSS vulnerable)
> 3. **MEDIUM** - Password validation happens client-side only
> 4. **MEDIUM** - No audit logging for failed login attempts
> 5. **LOW** - Magic number `3600` should be `SESSION_TIMEOUT_SECONDS`

The first review might miss a security vulnerability. The second caught four.

## Iteration and Diminishing Returns

After addressing findings, consider running it again. A second pass usually catches more. A third isn't always useless either. But each pass takes time, and eventually you hit diminishing returns - just nitpicks and false findings.

:::tip[Better Reviews]
Assume problems exist. Look for what's missing, not just what's wrong.
:::
</document>

<document path="explanation/brainstorming.md">
Unlock your creativity through guided exploration.

## What is Brainstorming?

Run `brainstorming` and you've got a creative facilitator pulling ideas out of you - not generating them for you. The AI acts as coach and guide, using proven techniques to create conditions where your best thinking emerges.

**Good for:**

- Breaking through creative blocks
- Generating product or feature ideas
- Exploring problems from new angles
- Developing raw concepts into action plans

## How It Works

1. **Setup** - Define topic, goals, constraints
2. **Choose approach** - Pick techniques yourself, get AI recommendations, go random, or follow a progressive flow
3. **Facilitation** - Work through techniques with probing questions and collaborative coaching
4. **Organize** - Ideas grouped into themes and prioritized
5. **Action** - Top ideas get next steps and success metrics

Everything gets captured in a session document you can reference later or share with stakeholders.

:::note[Your Ideas]
Every idea comes from you. The workflow creates conditions for insight - you're the source.
:::
</document>

<document path="explanation/party-mode.md">
Get all your AI agents in one conversation.

## What is Party Mode?

Run `party-mode` and you've got your whole AI team in one room - PM, Architect, Dev, UX Designer, whoever you need. BMad Master orchestrates, picking relevant agents per message. Agents respond in character, agree, disagree, and build on each other's ideas.

The conversation continues as long as you want. Ask follow-ups, push back on answers, redirect the discussion - it's a real back-and-forth with your agents until you're done.

**Good for:**

- Big decisions with tradeoffs
- Brainstorming sessions
- Post-mortems when things go wrong
- Sprint retrospectives and planning

## Examples

### Calling Out Bad Architecture

**You:** "Okay team, our last sprint was a disaster. The authentication service went down three times. Who screwed this up?"

**Architect:** "The design was sound - distributed authentication with proper fallbacks. If implementation deviated from the spec..."

**Dev:** "I followed the architecture doc exactly. The spec didn't account for concurrent session invalidation race conditions."

**PM:** "Both of you missed the bigger issue - we didn't validate session management requirements in the PRD. This is on me for not catching it."

**TEA:** "And I should've caught this in integration tests. The test scenarios didn't cover concurrent invalidation."

### Creative Brainstorming

**You:** "How do we make onboarding feel magical instead of boring?"

**UX Designer:** "Start with progressive disclosure - reveal features as users need them, not all at once in a tutorial."

**Storyteller:** "What if onboarding was a story? Each step reveals a character's journey - the user IS the hero."

**Game Designer:** "Building on that - what if the first 'quest' is actually solving a real user problem? They learn by doing something valuable."

### Technical Decision

**You:** "Monolith or microservices for MVP?"

**Architect:** "Start monolith. Microservices add complexity you don't need at 1000 users."

**PM:** "Agree. Time to market matters more than theoretical scalability."

**Dev:** "Monolith with clear module boundaries. We can extract services later if needed."

:::tip[Better Decisions]
Better decisions through diverse perspectives. Welcome to party mode.
:::
</document>

<document path="explanation/preventing-agent-conflicts.md">
When multiple AI agents implement different parts of a system, they can make conflicting technical decisions. Architecture documentation prevents this by establishing shared standards.

## Common Conflict Types

### API Style Conflicts

Without architecture:
- Agent A uses REST with `/users/{id}`
- Agent B uses GraphQL mutations
- Result: Inconsistent API patterns, confused consumers

With architecture:
- ADR specifies: "Use GraphQL for all client-server communication"
- All agents follow the same pattern

### Database Design Conflicts

Without architecture:
- Agent A uses snake_case column names
- Agent B uses camelCase column names
- Result: Inconsistent schema, confusing queries

With architecture:
- Standards document specifies naming conventions
- All agents follow the same patterns

### State Management Conflicts

Without architecture:
- Agent A uses Redux for global state
- Agent B uses React Context
- Result: Multiple state management approaches, complexity

With architecture:
- ADR specifies state management approach
- All agents implement consistently

## How Architecture Prevents Conflicts

### 1. Explicit Decisions via ADRs

Every significant technology choice is documented with:
- Context (why this decision matters)
- Options considered (what alternatives exist)
- Decision (what we chose)
- Rationale (why we chose it)
- Consequences (trade-offs accepted)

### 2. FR/NFR-Specific Guidance

Architecture maps each functional requirement to technical approach:
- FR-001: User Management → GraphQL mutations
- FR-002: Mobile App → Optimized queries

### 3. Standards and Conventions

Explicit documentation of:
- Directory structure
- Naming conventions
- Code organization
- Testing patterns

## Architecture as Shared Context

Think of architecture as the shared context that all agents read before implementing:

```text
PRD: "What to build"
     ↓
Architecture: "How to build it"
     ↓
Agent A reads architecture → implements Epic 1
Agent B reads architecture → implements Epic 2
Agent C reads architecture → implements Epic 3
     ↓
Result: Consistent implementation
```

## Key ADR Topics

Common decisions that prevent conflicts:

| Topic            | Example Decision                             |
| ---------------- | -------------------------------------------- |
| API Style        | GraphQL vs REST vs gRPC                      |
| Database         | PostgreSQL vs MongoDB                        |
| Auth             | JWT vs Sessions                              |
| State Management | Redux vs Context vs Zustand                  |
| Styling          | CSS Modules vs Tailwind vs Styled Components |
| Testing          | Jest + Playwright vs Vitest + Cypress        |

## Anti-Patterns to Avoid

:::caution[Common Mistakes]
- **Implicit Decisions** — "We'll figure out the API style as we go" leads to inconsistency
- **Over-Documentation** — Documenting every minor choice causes analysis paralysis
- **Stale Architecture** — Documents written once and never updated cause agents to follow outdated patterns
:::

:::tip[Correct Approach]
- Document decisions that cross epic boundaries
- Focus on conflict-prone areas
- Update architecture as you learn
- Use `correct-course` for significant changes
:::
</document>

<document path="explanation/project-context.md">
The `project-context.md` file is your project's implementation guide for AI agents. Similar to a "constitution" in other development systems, it captures the rules, patterns, and preferences that ensure consistent code generation across all workflows.

## What It Does

AI agents make implementation decisions constantly — which patterns to follow, how to structure code, what conventions to use. Without clear guidance, they may:
- Follow generic best practices that don't match your codebase
- Make inconsistent decisions across different stories
- Miss project-specific requirements or constraints

The `project-context.md` file solves this by documenting what agents need to know in a concise, LLM-optimized format.

## How It Works

Every implementation workflow automatically loads `project-context.md` if it exists. The architect workflow also loads it to respect your technical preferences when designing the architecture.

**Loaded by these workflows:**
- `create-architecture` — respects technical preferences during solutioning
- `create-story` — informs story creation with project patterns
- `dev-story` — guides implementation decisions
- `code-review` — validates against project standards
- `quick-dev` — applies patterns when implementing tech-specs
- `sprint-planning`, `retrospective`, `correct-course` — provides project-wide context

## When to Create It

The `project-context.md` file is useful at any stage of a project:

| Scenario | When to Create | Purpose |
|----------|----------------|---------|
| **New project, before architecture** | Manually, before `create-architecture` | Document your technical preferences so the architect respects them |
| **New project, after architecture** | Via `generate-project-context` or manually | Capture architecture decisions for implementation agents |
| **Existing project** | Via `generate-project-context` | Discover existing patterns so agents follow established conventions |
| **Quick Flow project** | Before or during `quick-dev` | Ensure quick implementation respects your patterns |

:::tip[Recommended]
For new projects, create it manually before architecture if you have strong technical preferences. Otherwise, generate it after architecture to capture those decisions.
:::

## What Goes In It

The file has two main sections:

### Technology Stack & Versions

Documents the frameworks, languages, and tools your project uses with specific versions:

```markdown
## Technology Stack & Versions

- Node.js 20.x, TypeScript 5.3, React 18.2
- State: Zustand (not Redux)
- Testing: Vitest, Playwright, MSW
- Styling: Tailwind CSS with custom design tokens
```

### Critical Implementation Rules

Documents patterns and conventions that agents might otherwise miss:

```markdown
## Critical Implementation Rules

**TypeScript Configuration:**
- Strict mode enabled — no `any` types without explicit approval
- Use `interface` for public APIs, `type` for unions/intersections

**Code Organization:**
- Components in `/src/components/` with co-located `.test.tsx`
- Utilities in `/src/lib/` for reusable pure functions
- API calls use the `apiClient` singleton — never fetch directly

**Testing Patterns:**
- Unit tests focus on business logic, not implementation details
- Integration tests use MSW to mock API responses
- E2E tests cover critical user journeys only

**Framework-Specific:**
- All async operations use the `handleError` wrapper for consistent error handling
- Feature flags accessed via `featureFlag()` from `@/lib/flags`
- New routes follow the file-based routing pattern in `/src/app/`
```

Focus on what's **unobvious** — things agents might not infer from reading code snippets. Don't document standard practices that apply universally.

## Creating the File

You have three options:

### Manual Creation

Create the file at `_bmad-output/project-context.md` and add your rules:

```bash
# In your project root
mkdir -p _bmad-output
touch _bmad-output/project-context.md
```

Edit it with your technology stack and implementation rules. The architect and implementation workflows will automatically find and load it.

### Generate After Architecture

Run the `generate-project-context` workflow after completing your architecture:

```bash
/bmad-bmm-generate-project-context
```

This scans your architecture document and project files to generate a context file capturing the decisions made.

### Generate for Existing Projects

For existing projects, run `generate-project-context` to discover existing patterns:

```bash
/bmad-bmm-generate-project-context
```

The workflow analyzes your codebase to identify conventions, then generates a context file you can review and refine.

## Why It Matters

Without `project-context.md`, agents make assumptions that may not match your project:

| Without Context | With Context |
|----------------|--------------|
| Uses generic patterns | Follows your established conventions |
| Inconsistent style across stories | Consistent implementation |
| May miss project-specific constraints | Respects all technical requirements |
| Each agent decides independently | All agents align with same rules |

This is especially important for:
- **Quick Flow** — skips PRD and architecture, so context file fills the gap
- **Team projects** — ensures all agents follow the same standards
- **Existing projects** — prevents breaking established patterns

## Editing and Updating

The `project-context.md` file is a living document. Update it when:

- Architecture decisions change
- New conventions are established
- Patterns evolve during implementation
- You identify gaps from agent behavior

You can edit it manually at any time, or re-run `generate-project-context` to update it after significant changes.

:::note[File Location]
The default location is `_bmad-output/project-context.md`. Workflows search for it there, and also check `**/project-context.md` anywhere in your project.
:::
</document>

<document path="explanation/quick-flow.md">
Skip the ceremony. Quick Flow takes you from idea to working code in two commands - no Product Brief, no PRD, no Architecture doc.

## When to Use It

- Bug fixes and patches
- Refactoring existing code
- Small, well-understood features
- Prototyping and spikes
- Single-agent work where one developer can hold the full scope

## When NOT to Use It

- New products or platforms that need stakeholder alignment
- Major features spanning multiple components or teams
- Work that requires architectural decisions (database schema, API contracts, service boundaries)
- Anything where requirements are unclear or contested

:::caution[Scope Creep]
If you start a Quick Flow and realize the scope is bigger than expected, `quick-dev` will detect this and offer to escalate. You can switch to a full PRD workflow at any point without losing your work.
:::

## How It Works

Quick Flow has two commands, each backed by a structured workflow. You can run them together or independently.

### quick-spec: Plan

Run `quick-spec` and Barry (the Quick Flow agent) walks you through a conversational discovery process:

1. **Understand** - You describe what you want to build. Barry scans the codebase to ask informed questions, then captures a problem statement, solution approach, and scope boundaries.
2. **Investigate** - Barry reads relevant files, maps code patterns, identifies files to modify, and documents the technical context.
3. **Generate** - Produces a complete tech-spec with ordered implementation tasks (specific file paths and actions), acceptance criteria in Given/When/Then format, testing strategy, and dependencies.
4. **Review** - Presents the full spec for your sign-off. You can edit, ask questions, run adversarial review, or refine with advanced elicitation before finalizing.

The output is a `tech-spec-{slug}.md` file saved to your project's implementation artifacts folder. It contains everything a fresh agent needs to implement the feature - no conversation history required.

### quick-dev: Build

Run `quick-dev` and Barry implements the work. It operates in two modes:

- **Tech-spec mode** - Point it at a spec file (`quick-dev tech-spec-auth.md`) and it executes every task in order, writes tests, and verifies acceptance criteria.
- **Direct mode** - Give it instructions directly (`quick-dev "refactor the auth middleware"`) and it gathers context, builds a mental plan, and executes.

After implementation, `quick-dev` runs a self-check audit against all tasks and acceptance criteria, then triggers an adversarial code review of the diff. Findings are presented for you to resolve before wrapping up.

:::tip[Fresh Context]
For best results, run `quick-dev` in a new conversation after finishing `quick-spec`. This gives the implementation agent clean context focused solely on building.
:::

## What Quick Flow Skips

The full BMad Method produces a Product Brief, PRD, Architecture doc, and Epic/Story breakdown before any code is written. Quick Flow replaces all of that with a single tech-spec. This works because Quick Flow targets changes where:

- The product direction is already established
- Architecture decisions are already made
- A single developer can reason about the full scope
- Requirements fit in one conversation

## Escalating to Full BMad Method

Quick Flow includes built-in guardrails for scope detection. When you run `quick-dev` with a direct request, it evaluates signals like multi-component mentions, system-level language, and uncertainty about approach. If it detects the work is bigger than a quick flow:

- **Light escalation** - Recommends running `quick-spec` first to create a plan
- **Heavy escalation** - Recommends switching to the full BMad Method PRD process

You can also escalate manually at any time. Your tech-spec work carries forward - it becomes input for the broader planning process rather than being discarded.
</document>

<document path="explanation/why-solutioning-matters.md">
Phase 3 (Solutioning) translates **what** to build (from Planning) into **how** to build it (technical design). This phase prevents agent conflicts in multi-epic projects by documenting architectural decisions before implementation begins.

## The Problem Without Solutioning

```text
Agent 1 implements Epic 1 using REST API
Agent 2 implements Epic 2 using GraphQL
Result: Inconsistent API design, integration nightmare
```

When multiple agents implement different parts of a system without shared architectural guidance, they make independent technical decisions that may conflict.

## The Solution With Solutioning

```text
architecture workflow decides: "Use GraphQL for all APIs"
All agents follow architecture decisions
Result: Consistent implementation, no conflicts
```

By documenting technical decisions explicitly, all agents implement consistently and integration becomes straightforward.

## Solutioning vs Planning

| Aspect   | Planning (Phase 2)      | Solutioning (Phase 3)             |
| -------- | ----------------------- | --------------------------------- |
| Question | What and Why?           | How? Then What units of work?     |
| Output   | FRs/NFRs (Requirements) | Architecture + Epics/Stories      |
| Agent    | PM                      | Architect → PM                    |
| Audience | Stakeholders            | Developers                        |
| Document | PRD (FRs/NFRs)          | Architecture + Epic Files         |
| Level    | Business logic          | Technical design + Work breakdown |

## Key Principle

**Make technical decisions explicit and documented** so all agents implement consistently.

This prevents:
- API style conflicts (REST vs GraphQL)
- Database design inconsistencies
- State management disagreements
- Naming convention mismatches
- Security approach variations

## When Solutioning is Required

| Track | Solutioning Required? |
|-------|----------------------|
| Quick Flow | No - skip entirely |
| BMad Method Simple | Optional |
| BMad Method Complex | Yes |
| Enterprise | Yes |

:::tip[Rule of Thumb]
If you have multiple epics that could be implemented by different agents, you need solutioning.
:::

## The Cost of Skipping

Skipping solutioning on complex projects leads to:

- **Integration issues** discovered mid-sprint
- **Rework** due to conflicting implementations
- **Longer development time** overall
- **Technical debt** from inconsistent patterns

:::caution[Cost Multiplier]
Catching alignment issues in solutioning is 10× faster than discovering them during implementation.
:::
</document>

<document path="reference/agents.md">
## Default Agents

This page lists the default BMM (Agile suite) agents that install with BMad Method, along with their menu triggers and primary workflows.

## Notes

- Triggers are the short menu codes (e.g., `CP`) and fuzzy matches shown in each agent menu.
- Slash commands are generated separately. See [Commands](./commands.md) for the slash command list and where they are defined.
- QA (Quinn) is the lightweight test automation agent in BMM. The full Test Architect (TEA) lives in its own module.

| Agent                       | Triggers                           | Primary workflows                                                                                   |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Analyst (Mary)              | `BP`, `RS`, `CB`, `DP`             | Brainstorm Project, Research, Create Brief, Document Project                                        |
| Product Manager (John)      | `CP`, `VP`, `EP`, `CE`, `IR`, `CC` | Create/Validate/Edit PRD, Create Epics and Stories, Implementation Readiness, Correct Course        |
| Architect (Winston)         | `CA`, `IR`                         | Create Architecture, Implementation Readiness                                                       |
| Scrum Master (Bob)          | `SP`, `CS`, `ER`, `CC`             | Sprint Planning, Create Story, Epic Retrospective, Correct Course                                   |
| Developer (Amelia)          | `DS`, `CR`                         | Dev Story, Code Review                                                                              |
| QA Engineer (Quinn)         | `QA`                               | Automate (generate tests for existing features)                                                     |
| Quick Flow Solo Dev (Barry) | `QS`, `QD`, `CR`                   | Quick Spec, Quick Dev, Code Review                                                                  |
| UX Designer (Sally)         | `CU`                               | Create UX Design                                                                                    |
| Technical Writer (Paige)    | `DP`, `WD`, `US`, `MG`, `VD`, `EC` | Document Project, Write Document, Update Standards, Mermaid Generate, Validate Doc, Explain Concept |
</document>

<document path="reference/commands.md">
Slash commands are pre-built prompts that load agents, run workflows, or execute tasks inside your IDE. The BMad installer generates them from your installed modules at install time. If you later add, remove, or change modules, re-run the installer to keep commands in sync (see [Troubleshooting](#troubleshooting)).

## Commands vs. Agent Menu Triggers

BMad offers two ways to start work, and they serve different purposes.

| Mechanism | How you invoke it | What happens |
| --- | --- | --- |
| **Slash command** | Type `/bmad-...` in your IDE | Directly loads an agent, runs a workflow, or executes a task |
| **Agent menu trigger** | Load an agent first, then type a short code (e.g. `DS`) | The agent interprets the code and starts the matching workflow while staying in character |

Agent menu triggers require an active agent session. Use slash commands when you know which workflow you want. Use triggers when you are already working with an agent and want to switch tasks without leaving the conversation.

## How Commands Are Generated

When you run `npx bmad-method install`, the installer reads the manifests for every selected module and writes one command file per agent, workflow, task, and tool. Each file is a short markdown prompt that instructs the AI to load the corresponding source file and follow its instructions.

The installer uses templates for each command type:

| Command type | What the generated file does |
| --- | --- |
| **Agent launcher** | Loads the agent persona file, activates its menu, and stays in character |
| **Workflow command** | Loads the workflow engine (`workflow.xml`) and passes the workflow config |
| **Task command** | Loads a standalone task file and follows its instructions |
| **Tool command** | Loads a standalone tool file and follows its instructions |

:::note[Re-running the installer]
If you add or remove modules, run the installer again. It regenerates all command files to match your current module selection.
:::

## Where Command Files Live

The installer writes command files into an IDE-specific directory inside your project. The exact path depends on which IDE you selected during installation.

| IDE / CLI | Command directory |
| --- | --- |
| Claude Code | `.claude/commands/` |
| Cursor | `.cursor/commands/` |
| Windsurf | `.windsurf/workflows/` |
| Other IDEs | See the installer output for the target path |

All IDEs receive a flat set of command files in their command directory. For example, a Claude Code installation looks like:

```text
.claude/commands/
├── bmad-agent-bmm-dev.md
├── bmad-agent-bmm-pm.md
├── bmad-bmm-create-prd.md
├── bmad-editorial-review-prose.md
├── bmad-help.md
└── ...
```

The filename determines the slash command name in your IDE. For example, the file `bmad-agent-bmm-dev.md` registers the command `/bmad-agent-bmm-dev`.

## How to Discover Your Commands

Type `/bmad` in your IDE and use autocomplete to browse available commands.

Run `/bmad-help` for context-aware guidance on your next step.

:::tip[Quick discovery]
The generated command folders in your project are the canonical list. Open them in your file explorer to see every command with its description.
:::

## Command Categories

### Agent Commands

Agent commands load a specialized AI persona with a defined role, communication style, and menu of workflows. Once loaded, the agent stays in character and responds to menu triggers.

| Example command | Agent | Role |
| --- | --- | --- |
| `/bmad-agent-bmm-dev` | Amelia (Developer) | Implements stories with strict adherence to specs |
| `/bmad-agent-bmm-pm` | John (Product Manager) | Creates and validates PRDs |
| `/bmad-agent-bmm-architect` | Winston (Architect) | Designs system architecture |
| `/bmad-agent-bmm-sm` | Bob (Scrum Master) | Manages sprints and stories |

See [Agents](./agents.md) for the full list of default agents and their triggers.

### Workflow Commands

Workflow commands run a structured, multi-step process without loading an agent persona first. They load the workflow engine and pass a specific workflow configuration.

| Example command | Purpose |
| --- | --- |
| `/bmad-bmm-create-prd` | Create a Product Requirements Document |
| `/bmad-bmm-create-architecture` | Design system architecture |
| `/bmad-bmm-dev-story` | Implement a story |
| `/bmad-bmm-code-review` | Run a code review |
| `/bmad-bmm-quick-spec` | Define an ad-hoc change (Quick Flow) |

See [Workflow Map](./workflow-map.md) for the complete workflow reference organized by phase.

### Task and Tool Commands

Tasks and tools are standalone operations that do not require an agent or workflow context.

#### BMad-Help: Your Intelligent Guide

**`/bmad-help`** is your primary interface for discovering what to do next. It's not just a lookup tool — it's an intelligent assistant that:

- **Inspects your project** to see what's already been done
- **Understands natural language queries** — ask questions in plain English
- **Varies by installed modules** — shows options based on what you have
- **Auto-invokes after workflows** — every workflow ends with clear next steps
- **Recommends the first required task** — no guessing where to start

**Examples:**

```
/bmad-help
/bmad-help I have a SaaS idea and know all the features. Where do I start?
/bmad-help What are my options for UX design?
/bmad-help I'm stuck on the PRD workflow
```

#### Other Tasks and Tools

| Example command | Purpose |
| --- | --- |
| `/bmad-shard-doc` | Split a large markdown file into smaller sections |
| `/bmad-index-docs` | Index project documentation |
| `/bmad-editorial-review-prose` | Review document prose quality |

## Naming Convention

Command names follow a predictable pattern.

| Pattern | Meaning | Example |
| --- | --- | --- |
| `bmad-agent-<module>-<name>` | Agent launcher | `bmad-agent-bmm-dev` |
| `bmad-<module>-<workflow>` | Workflow command | `bmad-bmm-create-prd` |
| `bmad-<name>` | Core task or tool | `bmad-help` |

Module codes: `bmm` (Agile suite), `bmb` (Builder), `tea` (Test Architect), `cis` (Creative Intelligence), `gds` (Game Dev Studio). See [Modules](./modules.md) for descriptions.

## Troubleshooting

**Commands not appearing after install.** Restart your IDE or reload the window. Some IDEs cache the command list and require a refresh to pick up new files.

**Expected commands are missing.** The installer only generates commands for modules you selected. Run `npx bmad-method install` again and verify your module selection. Check that the command files exist in the expected directory.

**Commands from a removed module still appear.** The installer does not delete old command files automatically. Remove the stale files from your IDE's command directory, or delete the entire command directory and re-run the installer for a clean set.
</document>

<document path="reference/modules.md">
BMad extends through official modules that you select during installation. These add-on modules provide specialized agents, workflows, and tasks for specific domains beyond the built-in core and BMM (Agile suite).

:::tip[Installing Modules]
Run `npx bmad-method install` and select the modules you want. The installer handles downloading, configuration, and IDE integration automatically.
:::

## BMad Builder

Create custom agents, workflows, and domain-specific modules with guided assistance. BMad Builder is the meta-module for extending the framework itself.

- **Code:** `bmb`
- **npm:** [`bmad-builder`](https://www.npmjs.com/package/bmad-builder)
- **GitHub:** [bmad-code-org/bmad-builder](https://github.com/bmad-code-org/bmad-builder)

**Provides:**

- Agent Builder -- create specialized AI agents with custom expertise and tool access
- Workflow Builder -- design structured processes with steps and decision points
- Module Builder -- package agents and workflows into shareable, publishable modules
- Interactive setup with YAML configuration and npm publishing support

## Creative Intelligence Suite

AI-powered tools for structured creativity, ideation, and innovation during early-stage development. The suite provides multiple agents that facilitate brainstorming, design thinking, and problem-solving using proven frameworks.

- **Code:** `cis`
- **npm:** [`bmad-creative-intelligence-suite`](https://www.npmjs.com/package/bmad-creative-intelligence-suite)
- **GitHub:** [bmad-code-org/bmad-module-creative-intelligence-suite](https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite)

**Provides:**

- Innovation Strategist, Design Thinking Coach, and Brainstorming Coach agents
- Problem Solver and Creative Problem Solver for systematic and lateral thinking
- Storyteller and Presentation Master for narratives and pitches
- Ideation frameworks including SCAMPER, Reverse Brainstorming, and problem reframing

## Game Dev Studio

Structured game development workflows adapted for Unity, Unreal, Godot, and custom engines. Supports rapid prototyping through Quick Flow and full-scale production with epic-driven sprints.

- **Code:** `gds`
- **npm:** [`bmad-game-dev-studio`](https://www.npmjs.com/package/bmad-game-dev-studio)
- **GitHub:** [bmad-code-org/bmad-module-game-dev-studio](https://github.com/bmad-code-org/bmad-module-game-dev-studio)

**Provides:**

- Game Design Document (GDD) generation workflow
- Quick Dev mode for rapid prototyping
- Narrative design support for characters, dialogue, and world-building
- Coverage for 21+ game types with engine-specific architecture guidance

## Test Architect (TEA)

Enterprise-grade test strategy, automation guidance, and release gate decisions through an expert agent and nine structured workflows. TEA goes well beyond the built-in QA agent with risk-based prioritization and requirements traceability.

- **Code:** `tea`
- **npm:** [`bmad-method-test-architecture-enterprise`](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise)
- **GitHub:** [bmad-code-org/bmad-method-test-architecture-enterprise](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise)

**Provides:**

- Murat agent (Master Test Architect and Quality Advisor)
- Workflows for test design, ATDD, automation, test review, and traceability
- NFR assessment, CI setup, and framework scaffolding
- P0-P3 prioritization with optional Playwright Utils and MCP integrations

## Community Modules

Community modules and a module marketplace are coming. Check the [BMad GitHub organization](https://github.com/bmad-code-org) for updates.
</document>

<document path="reference/testing.md">
BMad provides two testing paths: a built-in QA agent for fast test generation and an installable Test Architect module for enterprise-grade test strategy.

## Which Should You Use?

| Factor | Quinn (Built-in QA) | TEA Module |
| --- | --- | --- |
| **Best for** | Small-medium projects, quick coverage | Large projects, regulated or complex domains |
| **Setup** | Nothing to install -- included in BMM | Install separately via `npx bmad-method install` |
| **Approach** | Generate tests fast, iterate later | Plan first, then generate with traceability |
| **Test types** | API and E2E tests | API, E2E, ATDD, NFR, and more |
| **Strategy** | Happy path + critical edge cases | Risk-based prioritization (P0-P3) |
| **Workflow count** | 1 (Automate) | 9 (design, ATDD, automate, review, trace, and others) |

:::tip[Start with Quinn]
Most projects should start with Quinn. If you later need test strategy, quality gates, or requirements traceability, install TEA alongside it.
:::

## Built-in QA Agent (Quinn)

Quinn is the built-in QA agent in the BMM (Agile suite) module. It generates working tests quickly using your project's existing test framework -- no configuration or additional installation required.

**Trigger:** `QA` or `bmad-bmm-qa-automate`

### What Quinn Does

Quinn runs a single workflow (Automate) that walks through five steps:

1. **Detect test framework** -- scans `package.json` and existing test files for your framework (Jest, Vitest, Playwright, Cypress, or any standard runner). If none exists, analyzes the project stack and suggests one.
2. **Identify features** -- asks what to test or auto-discovers features in the codebase.
3. **Generate API tests** -- covers status codes, response structure, happy path, and 1-2 error cases.
4. **Generate E2E tests** -- covers user workflows with semantic locators and visible-outcome assertions.
5. **Run and verify** -- executes the generated tests and fixes failures immediately.

Quinn produces a test summary saved to your project's implementation artifacts folder.

### Test Patterns

Generated tests follow a "simple and maintainable" philosophy:

- **Standard framework APIs only** -- no external utilities or custom abstractions
- **Semantic locators** for UI tests (roles, labels, text rather than CSS selectors)
- **Independent tests** with no order dependencies
- **No hardcoded waits or sleeps**
- **Clear descriptions** that read as feature documentation

:::note[Scope]
Quinn generates tests only. For code review and story validation, use the Code Review workflow (`CR`) instead.
:::

### When to Use Quinn

- Quick test coverage for a new or existing feature
- Beginner-friendly test automation without advanced setup
- Standard test patterns that any developer can read and maintain
- Small-medium projects where comprehensive test strategy is unnecessary

## Test Architect (TEA) Module

TEA is a standalone module that provides an expert agent (Murat) and nine structured workflows for enterprise-grade testing. It goes beyond test generation into test strategy, risk-based planning, quality gates, and requirements traceability.

- **Documentation:** [TEA Module Docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/)
- **Install:** `npx bmad-method install` and select the TEA module
- **npm:** [`bmad-method-test-architecture-enterprise`](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise)

### What TEA Provides

| Workflow | Purpose |
| --- | --- |
| Test Design | Create a comprehensive test strategy tied to requirements |
| ATDD | Acceptance-test-driven development with stakeholder criteria |
| Automate | Generate tests with advanced patterns and utilities |
| Test Review | Validate test quality and coverage against strategy |
| Traceability | Map tests back to requirements for audit and compliance |
| NFR Assessment | Evaluate non-functional requirements (performance, security) |
| CI Setup | Configure test execution in continuous integration pipelines |
| Framework Scaffolding | Set up test infrastructure and project structure |
| Release Gate | Make data-driven go/no-go release decisions |

TEA also supports P0-P3 risk-based prioritization and optional integrations with Playwright Utils and MCP tooling.

### When to Use TEA

- Projects that require requirements traceability or compliance documentation
- Teams that need risk-based test prioritization across many features
- Enterprise environments with formal quality gates before release
- Complex domains where test strategy must be planned before tests are written
- Projects that have outgrown Quinn's single-workflow approach

## How Testing Fits into Workflows

Quinn's Automate workflow appears in Phase 4 (Implementation) of the BMad Method workflow map. A typical sequence:

1. Implement a story with the Dev workflow (`DS`)
2. Generate tests with Quinn (`QA`) or TEA's Automate workflow
3. Validate implementation with Code Review (`CR`)

Quinn works directly from source code without loading planning documents (PRD, architecture). TEA workflows can integrate with upstream planning artifacts for traceability.

For more on where testing fits in the overall process, see the [Workflow Map](./workflow-map.md).
</document>

<document path="reference/workflow-map.md">
The BMad Method (BMM) is a module in the BMad Ecosystem, targeted at following the best practices of context engineering and planning. AI agents work best with clear, structured context. The BMM system builds that context progressively across 4 distinct phases - each phase, and multiple workflows optionally within each phase, produce documents that inform the next, so agents always know what to build and why.

The rationale and concepts come from agile methodologies that have been used across the industry with great success as a mental framework.

If at any time you are unsure what to do, the `/bmad-help` command will help you stay on track or know what to do next. You can always refer to this for reference also - but /bmad-help is fully interactive and much quicker if you have already installed the BMad Method. Additionally, if you are using different modules that have extended the BMad Method or added other complementary non-extension modules - the /bmad-help evolves to know all that is available to give you the best in-the-moment advice.

Final important note: Every workflow below can be run directly with your tool of choice via slash command or by loading an agent first and using the entry from the agents menu.

<iframe src="/workflow-map-diagram.html" title="BMad Method Workflow Map Diagram" width="100%" height="100%" style="border-radius: 8px; border: 1px solid #334155; min-height: 900px;"></iframe>

<p style="font-size: 0.8rem; text-align: right; margin-top: -0.5rem; margin-bottom: 1rem;">
  <a href="/workflow-map-diagram.html" target="_blank" rel="noopener noreferrer">Open diagram in new tab ↗</a>
</p>

## Phase 1: Analysis (Optional)

Explore the problem space and validate ideas before committing to planning.

| Workflow                        | Purpose                                                                    | Produces                  |
| ------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| `bmad-brainstorming`            | Brainstorm Project Ideas with guided facilitation of a brainstorming coach | `brainstorming-report.md` |
| `bmad-bmm-research`             | Validate market, technical, or domain assumptions                          | Research findings         |
| `bmad-bmm-create-product-brief` | Capture strategic vision                                                   | `product-brief.md`        |

## Phase 2: Planning

Define what to build and for whom.

| Workflow                    | Purpose                                  | Produces     |
| --------------------------- | ---------------------------------------- | ------------ |
| `bmad-bmm-create-prd`       | Define requirements (FRs/NFRs)           | `PRD.md`     |
| `bmad-bmm-create-ux-design` | Design user experience (when UX matters) | `ux-spec.md` |

## Phase 3: Solutioning

Decide how to build it and break work into stories.

| Workflow                                  | Purpose                                    | Produces                    |
| ----------------------------------------- | ------------------------------------------ | --------------------------- |
| `bmad-bmm-create-architecture`            | Make technical decisions explicit          | `architecture.md` with ADRs |
| `bmad-bmm-create-epics-and-stories`       | Break requirements into implementable work | Epic files with stories     |
| `bmad-bmm-check-implementation-readiness` | Gate check before implementation           | PASS/CONCERNS/FAIL decision |

## Phase 4: Implementation

Build it, one story at a time. Coming soon, full phase 4 automation!

| Workflow                   | Purpose                                                                  | Produces                         |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| `bmad-bmm-sprint-planning` | Initialize tracking (once per project to sequence the dev cycle)         | `sprint-status.yaml`             |
| `bmad-bmm-create-story`    | Prepare next story for implementation                                    | `story-[slug].md`                |
| `bmad-bmm-dev-story`       | Implement the story                                                      | Working code + tests             |
| `bmad-bmm-code-review`     | Validate implementation quality                                          | Approved or changes requested    |
| `bmad-bmm-correct-course`  | Handle significant mid-sprint changes                                    | Updated plan or re-routing       |
| `bmad-bmm-automate`        | Generate tests for existing features - Use after a full epic is complete | End to End UI Focused Test suite |
| `bmad-bmm-retrospective`   | Review after epic completion                                             | Lessons learned                  |

## Quick Flow (Parallel Track)

Skip phases 1-3 for small, well-understood work.

| Workflow              | Purpose                                    | Produces                                      |
| --------------------- | ------------------------------------------ | --------------------------------------------- |
| `bmad-bmm-quick-spec` | Define an ad-hoc change                    | `tech-spec.md` (story file for small changes) |
| `bmad-bmm-quick-dev`  | Implement from spec or direct instructions | Working code + tests                          |

## Context Management

Each document becomes context for the next phase. The PRD tells the architect what constraints matter. The architecture tells the dev agent which patterns to follow. Story files give focused, complete context for implementation. Without this structure, agents make inconsistent decisions.

### Project Context

:::tip[Recommended]
Create `project-context.md` to ensure AI agents follow your project's rules and preferences. This file works like a constitution for your project — it guides implementation decisions across all workflows. This optional file can be generated at the end of Architecture Creation, or in an existing project it can be generated also to capture whats important to keep aligned with current conventions.
:::

**How to create it:**

- **Manually** — Create `_bmad-output/project-context.md` with your technology stack and implementation rules
- **Generate it** — Run `/bmad-bmm-generate-project-context` to auto-generate from your architecture or codebase

[**Learn more about project-context.md**](../explanation/project-context.md)
</document>

<document path="404.md">
The page you're looking for doesn't exist or has been moved.

[Return to Home](./index.md)
</document>

<document path="zh-cn/404.md">
您查找的页面不存在或已被移动。

[返回首页](./index.md)
</document>

<document path="zh-cn/explanation/advanced-elicitation.md">
让 LLM 重新审视它刚刚生成的内容。你选择一种推理方法，它将该方法应用于自己的输出，然后你决定是否保留改进。

## 什么是高级启发？

结构化的第二轮处理。与其要求 AI "再试一次" 或 "做得更好"，不如选择一种特定的推理方法，让 AI 通过该视角重新审视自己的输出。

这种区别很重要。模糊的请求会产生模糊的修订。命名的方法会强制采用特定的攻击角度，揭示出通用重试会遗漏的见解。

## 何时使用

- 在工作流生成内容后，你想要替代方案
- 当输出看起来还可以，但你怀疑还有更深层次的内容
- 对假设进行压力测试或发现弱点
- 对于重新思考有帮助的高风险内容

工作流在决策点提供高级启发——在 LLM 生成某些内容后，系统会询问你是否要运行它。

## 工作原理

1. LLM 为你的内容建议 5 种相关方法
2. 你选择一种（或重新洗牌以获取不同选项）
3. 应用方法，显示改进
4. 接受或丢弃，重复或继续

## 内置方法

有数十种推理方法可用。几个示例：

- **事前复盘** - 假设项目已经失败，反向推导找出原因
- **第一性原理思维** - 剥离假设，从基本事实重建
- **逆向思维** - 询问如何保证失败，然后避免这些事情
- **红队对蓝队** - 攻击你自己的工作，然后为它辩护
- **苏格拉底式提问** - 用"为什么？"和"你怎么知道？"挑战每个主张
- **约束移除** - 放下所有约束，看看有什么变化，然后有选择地加回
- **利益相关者映射** - 从每个利益相关者的角度重新评估
- **类比推理** - 在其他领域找到平行案例并应用其教训

还有更多。AI 会为你的内容选择最相关的选项——你选择运行哪一个。

:::tip[从这里开始]
对于任何规范或计划，事前复盘都是一个很好的首选。它始终能找到标准审查会遗漏的空白。
:::

---
## 术语说明

- **LLM**：大语言模型。一种基于深度学习的自然语言处理模型，能够理解和生成人类语言。
- **elicitation**：启发。在人工智能与提示工程中，指通过特定方法引导模型生成更高质量或更符合预期的输出。
- **pre-mortem analysis**：事前复盘。一种风险管理技术，假设项目已经失败，然后反向推导可能的原因，以提前识别和预防潜在问题。
- **first principles thinking**：第一性原理思维。一种将复杂问题分解为最基本事实或假设，然后从这些基本要素重新构建解决方案的思维方式。
- **inversion**：逆向思维。通过思考如何导致失败来避免失败，从而找到成功路径的思维方式。
- **red team vs blue team**：红队对蓝队。一种模拟对抗的方法，红队负责攻击和发现问题，蓝队负责防御和解决问题。
- **socratic questioning**：苏格拉底式提问。一种通过连续提问来揭示假设、澄清概念和深入思考的对话方法。
- **stakeholder mapping**：利益相关者映射。识别并分析项目中所有利益相关者及其利益、影响和关系的系统性方法。
- **analogical reasoning**：类比推理。通过将当前问题与已知相似领域的问题进行比较，从而借鉴解决方案或见解的推理方式。
</document>

<document path="zh-cn/explanation/adversarial-review.md">
通过要求发现问题来强制进行更深入的分析。

## 什么是对抗性评审？

一种评审技术，评审者*必须*发现问题。不允许"看起来不错"。评审者采取怀疑态度——假设问题存在并找到它们。

这不是为了消极。而是为了强制进行真正的分析，而不是对提交的内容进行草率浏览并盖章批准。

**核心规则：**你必须发现问题。零发现会触发停止——重新分析或解释原因。

## 为什么有效

普通评审容易受到确认偏差的影响。你浏览工作，没有发现突出的问题，就批准了它。"发现问题"的指令打破了这种模式：

- **强制彻底性**——在你足够努力地查看以发现问题之前，不能批准
- **捕捉遗漏**——"这里缺少什么？"成为一个自然的问题
- **提高信号质量**——发现是具体且可操作的，而不是模糊的担忧
- **信息不对称**——在新的上下文中运行评审（无法访问原始推理），以便你评估的是工件，而不是意图

## 在哪里使用

对抗性评审出现在 BMad 工作流程的各个地方——代码评审、实施就绪检查、规范验证等。有时它是必需步骤，有时是可选的（如高级启发或派对模式）。该模式适应任何需要审查的工件。

## 需要人工过滤

因为 AI 被*指示*要发现问题，它就会发现问题——即使问题不存在。预期会有误报：伪装成问题的吹毛求疵、对意图的误解，或完全幻觉化的担忧。

**你决定什么是真实的。**审查每个发现，忽略噪音，修复重要的内容。

## 示例

而不是：

> "身份验证实现看起来合理。已批准。"

对抗性评审产生：

> 1. **高** - `login.ts:47` - 失败尝试没有速率限制
> 2. **高** - 会话令牌存储在 localStorage 中（易受 XSS 攻击）
> 3. **中** - 密码验证仅在客户端进行
> 4. **中** - 失败登录尝试没有审计日志
> 5. **低** - 魔法数字 `3600` 应该是 `SESSION_TIMEOUT_SECONDS`

第一个评审可能会遗漏安全漏洞。第二个发现了四个。

## 迭代和收益递减

在处理发现后，考虑再次运行。第二轮通常会捕获更多。第三轮也不总是无用的。但每一轮都需要时间，最终你会遇到收益递减——只是吹毛求疵和虚假发现。

:::tip[更好的评审]
假设问题存在。寻找缺失的内容，而不仅仅是错误的内容。
:::

---
## 术语说明

- **adversarial review**：对抗性评审。一种强制评审者必须发现问题的评审技术，旨在防止草率批准。
- **confirmation bias**：确认偏差。倾向于寻找、解释和记忆符合自己已有信念的信息的心理倾向。
- **information asymmetry**：信息不对称。交易或评审中一方拥有比另一方更多或更好信息的情况。
- **false positives**：误报。错误地将不存在的问题识别为存在的问题。
- **diminishing returns**：收益递减。在投入持续增加的情况下，产出增长逐渐减少的现象。
- **XSS**：跨站脚本攻击（Cross-Site Scripting）。一种安全漏洞，攻击者可在网页中注入恶意脚本。
- **localStorage**：本地存储。浏览器提供的 Web Storage API，用于在客户端存储键值对数据。
- **magic number**：魔法数字。代码中直接出现的未命名数值常量，缺乏语义含义。
</document>

<document path="zh-cn/explanation/brainstorming.md">
通过引导式探索释放你的创造力。

## 什么是头脑风暴？

运行 `brainstorming`，你就拥有了一位创意引导者，帮助你从自身挖掘想法——而不是替你生成想法。AI 充当教练和向导，使用经过验证的技术，创造让你最佳思维涌现的条件。

**适用于：**

- 突破创意瓶颈
- 生成产品或功能想法
- 从新角度探索问题
- 将原始概念发展为行动计划

## 工作原理

1. **设置** - 定义主题、目标、约束
2. **选择方法** - 自己选择技术、获取 AI 推荐、随机选择或遵循渐进式流程
3. **引导** - 通过探索性问题和协作式教练引导完成技术
4. **组织** - 将想法按主题分组并确定优先级
5. **行动** - 为顶级想法制定下一步和成功指标

所有内容都会被记录在会议文档中，你可以稍后参考或与利益相关者分享。

:::note[你的想法]
每个想法都来自你。工作流程创造洞察的条件——你是源头。
:::

---
## 术语说明

- **brainstorming**：头脑风暴。一种集体或个人的创意生成方法，通过自由联想和发散思维产生大量想法。
- **ideation**：构思。产生想法、概念或解决方案的过程。
- **facilitator**：引导者。在会议或工作坊中引导讨论、促进参与并帮助达成目标的人。
- **creative blocks**：创意瓶颈。在创意过程中遇到的思维停滞或灵感枯竭状态。
- **probing questions**：探索性问题。旨在深入挖掘信息、激发思考或揭示潜在见解的问题。
- **stakeholders**：利益相关者。对项目或决策有利益关系或受其影响的个人或群体。
</document>

<document path="zh-cn/explanation/party-mode.md">
将所有 AI 智能体汇聚到一次对话中。

## 什么是 Party Mode？

运行 `party-mode`，你的整个 AI 团队就齐聚一堂——PM、架构师、开发者、UX 设计师，任何你需要的人。BMad Master 负责编排，根据每条消息选择相关的智能体。智能体以角色身份回应，彼此同意、反对，并在彼此的想法基础上继续构建。

对话可以持续到你想要的时间。提出追问、对答案提出质疑、引导讨论方向——这是与智能体之间真正的来回交流，直到你完成目标。

**适用于：**

- 需要权衡的重大决策
- 头脑风暴会议
- 出现问题时的复盘
- 冲刺回顾与规划

## 示例

### 指出糟糕的架构

**You:** "好了团队，我们上个冲刺是一场灾难。认证服务宕机了三次。谁搞砸了这件事？"

**Architect:** "设计本身是合理的——分布式认证，有适当的回退机制。如果实现偏离了规范……"

**Dev:** "我完全按照架构文档执行的。规范没有考虑到并发会话失效的竞态条件。"

**PM:** "你们两个都忽略了更大的问题——我们没有在 PRD 中验证会话管理需求。这是我的错，没有发现这一点。"

**TEA:** "我也应该在集成测试中发现这一点。测试场景没有覆盖并发失效。"

### 创意头脑风暴

**You:** "我们如何让入职体验变得神奇，而不是无聊？"

**UX Designer:** "从渐进式披露开始——在用户需要时揭示功能，而不是在教程中一次性展示所有内容。"

**Storyteller:** "如果入职是一个故事会怎样？每一步都揭示一个角色的旅程——用户就是英雄。"

**Game Designer:** "在此基础上——如果第一个'任务'实际上是解决一个真实的用户问题会怎样？他们通过做有价值的事情来学习。"

### 技术决策

**You:** "MVP 用单体还是微服务？"

**Architect:** "从单体开始。微服务会增加你在 1000 用户时不需要的复杂性。"

**PM:** "同意。上市时间比理论上的可扩展性更重要。"

**Dev:** "单体，但要有清晰的模块边界。如果需要，我们以后可以提取服务。"

:::tip[Better Decisions]
通过多元视角做出更好的决策。欢迎来到 party mode。
:::

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **PM**：产品经理（Product Manager）。
- **Architect**：架构师。
- **Dev**：开发者（Developer）。
- **UX Designer**：用户体验设计师。
- **TEA**：测试工程师（Test Engineer/Automation）。
- **PRD**：产品需求文档（Product Requirements Document）。
- **MVP**：最小可行产品（Minimum Viable Product）。
- **monolith**：单体架构。一种将应用程序构建为单一、统一单元的架构风格。
- **microservices**：微服务。一种将应用程序构建为一组小型、独立服务的架构风格。
- **progressive disclosure**：渐进式披露。一种交互设计模式，仅在用户需要时显示信息或功能。
- **post-mortem**：复盘。对事件或项目进行事后分析，以了解发生了什么以及如何改进。
- **sprint**：冲刺。敏捷开发中的固定时间周期，通常为 1-4 周。
- **race condition**：竞态条件。当多个进程或线程同时访问和操作共享数据时，系统行为取决于执行顺序的一种情况。
- **fallback**：回退机制。当主要方法失败时使用的备用方案。
- **time to market**：上市时间。产品从概念到推向市场所需的时间。
</document>

<document path="zh-cn/explanation/preventing-agent-conflicts.md">
当多个 AI 智能体实现系统的不同部分时，它们可能会做出相互冲突的技术决策。架构文档通过建立共享标准来防止这种情况。

## 常见冲突类型

### API 风格冲突

没有架构时：
- 智能体 A 使用 REST，路径为 `/users/{id}`
- 智能体 B 使用 GraphQL mutations
- 结果：API 模式不一致，消费者困惑

有架构时：
- ADR 指定："所有客户端-服务器通信使用 GraphQL"
- 所有智能体遵循相同的模式

### 数据库设计冲突

没有架构时：
- 智能体 A 使用 snake_case 列名
- 智能体 B 使用 camelCase 列名
- 结果：模式不一致，查询混乱

有架构时：
- 标准文档指定命名约定
- 所有智能体遵循相同的模式

### 状态管理冲突

没有架构时：
- 智能体 A 使用 Redux 管理全局状态
- 智能体 B 使用 React Context
- 结果：多种状态管理方法，复杂度增加

有架构时：
- ADR 指定状态管理方法
- 所有智能体一致实现

## 架构如何防止冲突

### 1. 通过 ADR 明确决策

每个重要的技术选择都记录以下内容：
- 上下文（为什么这个决策很重要）
- 考虑的选项（有哪些替代方案）
- 决策（我们选择了什么）
- 理由（为什么选择它）
- 后果（接受的权衡）

### 2. FR/NFR 特定指导

架构将每个功能需求映射到技术方法：
- FR-001：用户管理 → GraphQL mutations
- FR-002：移动应用 → 优化查询

### 3. 标准和约定

明确记录以下内容：
- 目录结构
- 命名约定
- 代码组织
- 测试模式

## 架构作为共享上下文

将架构视为所有智能体在实现之前阅读的共享上下文：

```text
PRD："构建什么"
     ↓
架构："如何构建"
     ↓
智能体 A 阅读架构 → 实现 Epic 1
智能体 B 阅读架构 → 实现 Epic 2
智能体 C 阅读架构 → 实现 Epic 3
     ↓
结果：一致的实现
```

## Key ADR Topics

防止冲突的常见决策：

| Topic            | Example Decision                             |
| ---------------- | -------------------------------------------- |
| API Style        | GraphQL vs REST vs gRPC                      |
| Database         | PostgreSQL vs MongoDB                        |
| Auth             | JWT vs Sessions                              |
| State Management | Redux vs Context vs Zustand                  |
| Styling          | CSS Modules vs Tailwind vs Styled Components |
| Testing          | Jest + Playwright vs Vitest + Cypress        |

## 避免的反模式

:::caution[常见错误]
- **隐式决策** — "我们边做边确定 API 风格"会导致不一致
- **过度文档化** — 记录每个次要选择会导致分析瘫痪
- **过时架构** — 文档写一次后从不更新，导致智能体遵循过时的模式
:::

:::tip[正确方法]
- 记录跨越 epic 边界的决策
- 专注于容易产生冲突的领域
- 随着学习更新架构
- 对重大变更使用 `correct-course`
:::

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **ADR**：架构决策记录（Architecture Decision Record）。用于记录重要架构决策及其背景、选项和后果的文档。
- **FR**：功能需求（Functional Requirement）。系统必须具备的功能或行为。
- **NFR**：非功能需求（Non-Functional Requirement）。系统性能、安全性、可扩展性等质量属性。
- **Epic**：史诗。大型功能或用户故事的集合，通常需要多个迭代完成。
- **snake_case**：蛇形命名法。单词之间用下划线连接，所有字母小写的命名风格。
- **camelCase**：驼峰命名法。除第一个单词外，每个单词首字母大写的命名风格。
- **GraphQL mutations**：GraphQL 变更操作。用于修改服务器数据的 GraphQL 操作类型。
- **Redux**：JavaScript 状态管理库。用于管理应用全局状态的可预测状态容器。
- **React Context**：React 上下文 API。用于在组件树中传递数据而无需逐层传递 props。
- **Zustand**：轻量级状态管理库。用于 React 应用的简单状态管理解决方案。
- **CSS Modules**：CSS 模块。将 CSS 作用域限制在组件内的技术。
- **Tailwind**：Tailwind CSS。实用优先的 CSS 框架。
- **Styled Components**：样式化组件。使用 JavaScript 编写样式的 React 库。
- **Jest**：JavaScript 测试框架。用于编写和运行测试的工具。
- **Playwright**：端到端测试框架。用于自动化浏览器测试的工具。
- **Vitest**：Vite 原生测试框架。快速且轻量的单元测试工具。
- **Cypress**：端到端测试框架。用于 Web 应用测试的工具。
- **gRPC**：远程过程调用框架。Google 开发的高性能 RPC 框架。
- **JWT**：JSON Web Token。用于身份验证的开放标准令牌。
- **PRD**：产品需求文档（Product Requirements Document）。描述产品功能、需求和目标的文档。
</document>

<document path="zh-cn/explanation/project-context.md">
[`project-context.md`](project-context.md) 文件是您的项目面向 AI 智能体的实施指南。类似于其他开发系统中的"宪法"，它记录了确保所有工作流中代码生成一致的规则、模式和偏好。

## 它的作用

AI 智能体不断做出实施决策——遵循哪些模式、如何组织代码、使用哪些约定。如果没有明确指导，它们可能会：
- 遵循与您的代码库不匹配的通用最佳实践
- 在不同的用户故事中做出不一致的决策
- 错过项目特定的需求或约束

[`project-context.md`](project-context.md) 文件通过以简洁、针对 LLM 优化的格式记录智能体需要了解的内容来解决这个问题。

## 它的工作原理

每个实施工作流都会自动加载 [`project-context.md`](project-context.md)（如果存在）。架构师工作流也会加载它，以便在设计架构时尊重您的技术偏好。

**由以下工作流加载：**
- `create-architecture` — 在解决方案设计期间尊重技术偏好
- `create-story` — 使用项目模式指导用户故事创建
- `dev-story` — 指导实施决策
- `code-review` — 根据项目标准进行验证
- `quick-dev` — 在实施技术规范时应用模式
- `sprint-planning`、`retrospective`、`correct-course` — 提供项目范围的上下文

## 何时创建

[`project-context.md`](project-context.md) 文件在项目的任何阶段都很有用：

| 场景 | 何时创建 | 目的 |
|----------|----------------|---------|
| **新项目，架构之前** | 手动，在 `create-architecture` 之前 | 记录您的技术偏好，以便架构师尊重它们 |
| **新项目，架构之后** | 通过 `generate-project-context` 或手动 | 捕获架构决策，供实施智能体使用 |
| **现有项目** | 通过 `generate-project-context` | 发现现有模式，以便智能体遵循既定约定 |
| **快速流程项目** | 在 `quick-dev` 之前或期间 | 确保快速实施尊重您的模式 |

:::tip[推荐]
对于新项目，如果您有强烈的技术偏好，请在架构之前手动创建。否则，在架构之后生成它以捕获这些决策。
:::

## 文件内容

该文件有两个主要部分：

### 技术栈与版本

记录项目使用的框架、语言和工具及其具体版本：

```markdown
## Technology Stack & Versions

- Node.js 20.x, TypeScript 5.3, React 18.2
- State: Zustand (not Redux)
- Testing: Vitest, Playwright, MSW
- Styling: Tailwind CSS with custom design tokens
```

### 关键实施规则

记录智能体可能忽略的模式和约定：

```markdown
## Critical Implementation Rules

**TypeScript Configuration:**
- Strict mode enabled — no `any` types without explicit approval
- Use `interface` for public APIs, `type` for unions/intersections

**Code Organization:**
- Components in `/src/components/` with co-located `.test.tsx`
- Utilities in `/src/lib/` for reusable pure functions
- API calls use the `apiClient` singleton — never fetch directly

**Testing Patterns:**
- Unit tests focus on business logic, not implementation details
- Integration tests use MSW to mock API responses
- E2E tests cover critical user journeys only

**Framework-Specific:**
- All async operations use the `handleError` wrapper for consistent error handling
- Feature flags accessed via `featureFlag()` from `@/lib/flags`
- New routes follow the file-based routing pattern in `/src/app/`
```

专注于那些**不明显**的内容——智能体可能无法从阅读代码片段中推断出来的内容。不要记录普遍适用的标准实践。

## 创建文件

您有三个选择：

### 手动创建

在 `_bmad-output/project-context.md` 创建文件并添加您的规则：

```bash
# In your project root
mkdir -p _bmad-output
touch _bmad-output/project-context.md
```

使用您的技术栈和实施规则编辑它。架构师和实施工作流将自动查找并加载它。

### 架构后生成

在完成架构后运行 `generate-project-context` 工作流：

```bash
/bmad-bmm-generate-project-context
```

这将扫描您的架构文档和项目文件，生成一个捕获所做决策的上下文文件。

### 为现有项目生成

对于现有项目，运行 `generate-project-context` 以发现现有模式：

```bash
/bmad-bmm-generate-project-context
```

该工作流分析您的代码库以识别约定，然后生成一个您可以审查和优化的上下文文件。

## 为什么重要

没有 [`project-context.md`](project-context.md)，智能体会做出可能与您的项目不匹配的假设：

| 没有上下文 | 有上下文 |
|----------------|--------------|
| 使用通用模式 | 遵循您的既定约定 |
| 用户故事之间风格不一致 | 实施一致 |
| 可能错过项目特定的约束 | 尊重所有技术需求 |
| 每个智能体独立决策 | 所有智能体遵循相同规则 |

这对于以下情况尤其重要：
- **快速流程** — 跳过 PRD 和架构，因此上下文文件填补了空白
- **团队项目** — 确保所有智能体遵循相同的标准
- **现有项目** — 防止破坏既定模式

## 编辑和更新

[`project-context.md`](project-context.md) 文件是一个动态文档。在以下情况下更新它：

- 架构决策发生变化
- 建立了新的约定
- 模式在实施过程中演变
- 您从智能体行为中发现差距

您可以随时手动编辑它，或者在重大更改后重新运行 `generate-project-context` 来更新它。

:::note[文件位置]
默认位置是 `_bmad-output/project-context.md`。工作流在那里搜索它，并且还会检查项目中任何位置的 `**/project-context.md`。
:::

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **workflow**：工作流。指一系列自动化或半自动化的任务流程。
- **PRD**：产品需求文档（Product Requirements Document）。描述产品功能、需求和目标的文档。
- **LLM**：大语言模型（Large Language Model）。指基于深度学习的自然语言处理模型。
- **singleton**：单例。一种设计模式，确保一个类只有一个实例。
- **E2E**：端到端（End-to-End）。指从用户角度出发的完整测试流程。
- **MSW**：Mock Service Worker。用于模拟 API 响应的库。
- **Vitest**：基于 Vite 的单元测试框架。
- **Playwright**：端到端测试框架。
- **Zustand**：轻量级状态管理库。
- **Redux**：JavaScript 应用状态管理库。
- **Tailwind CSS**：实用优先的 CSS 框架。
- **TypeScript**：JavaScript 的超集，添加了静态类型。
- **React**：用于构建用户界面的 JavaScript 库。
- **Node.js**：基于 Chrome V8 引擎的 JavaScript 运行时。
</document>

<document path="zh-cn/explanation/quick-flow.md">
跳过繁琐流程。Quick Flow 通过两条命令将你从想法带到可运行的代码 - 无需产品简报、无需 PRD、无需架构文档。

## 何时使用

- Bug 修复和补丁
- 重构现有代码
- 小型、易于理解的功能
- 原型设计和探索性开发
- 单智能体工作，一名开发者可以掌控完整范围

## 何时不使用

- 需要利益相关者对齐的新产品或平台
- 跨越多个组件或团队的主要功能
- 需要架构决策的工作（数据库架构、API 契约、服务边界）
- 需求不明确或有争议的任何工作

:::caution[Scope Creep]
如果你启动 Quick Flow 后发现范围超出预期，`quick-dev` 会检测到并提供升级选项。你可以在任何时间切换到完整的 PRD 工作流程，而不会丢失你的工作。
:::

## 工作原理

Quick Flow 有两条命令，每条都由结构化的工作流程支持。你可以一起运行它们，也可以独立运行。

### quick-spec：规划

运行 `quick-spec`，Barry（Quick Flow 智能体）会引导你完成对话式发现过程：

1. **理解** - 你描述想要构建的内容。Barry 扫描代码库以提出有针对性的问题，然后捕获问题陈述、解决方案方法和范围边界。
2. **调查** - Barry 读取相关文件，映射代码模式，识别需要修改的文件，并记录技术上下文。
3. **生成** - 生成完整的技术规范，包含有序的实现任务（具体文件路径和操作）、Given/When/Then 格式的验收标准、测试策略和依赖项。
4. **审查** - 展示完整规范供你确认。你可以在最终定稿前进行编辑、提问、运行对抗性审查或使用高级启发式方法进行优化。

输出是一个 `tech-spec-{slug}.md` 文件，保存到项目的实现工件文件夹中。它包含新智能体实现功能所需的一切 - 无需对话历史。

### quick-dev：构建

运行 `quick-dev`，Barry 实现工作。它以两种模式运行：

- **技术规范模式** - 指向规范文件（`quick-dev tech-spec-auth.md`），它按顺序执行每个任务，编写测试，并验证验收标准。
- **直接模式** - 直接给出指令（`quick-dev "refactor the auth middleware"`），它收集上下文，构建心智计划，并执行。

实现后，`quick-dev` 针对所有任务和验收标准运行自检审计，然后触发差异的对抗性代码审查。发现的问题会呈现给你，以便在收尾前解决。

:::tip[Fresh Context]
为获得最佳效果，在完成 `quick-spec` 后，在新对话中运行 `quick-dev`。这为实现智能体提供了专注于构建的干净上下文。
:::

## Quick Flow 跳过的内容

完整的 BMad 方法在编写任何代码之前会生成产品简报、PRD、架构文档和 Epic/Story 分解。Quick Flow 用单个技术规范替代所有这些。这之所以有效，是因为 Quick Flow 针对以下变更：

- 产品方向已确立
- 架构决策已做出
- 单个开发者可以推理完整范围
- 需求可以在一次对话中涵盖

## 升级到完整 BMad 方法

Quick Flow 包含内置的范围检测护栏。当你使用直接请求运行 `quick-dev` 时，它会评估多组件提及、系统级语言和方法不确定性等信号。如果检测到工作超出快速流程范围：

- **轻度升级** - 建议先运行 `quick-spec` 创建计划
- **重度升级** - 建议切换到完整的 BMad 方法 PRD 流程

你也可以随时手动升级。你的技术规范工作会继续推进 - 它将成为更广泛规划过程的输入，而不是被丢弃。

---
## 术语说明

- **Quick Flow**：快速流程。BMad 方法中用于小型变更的简化工作流程，跳过完整的产品规划和架构文档阶段。
- **PRD**：Product Requirements Document，产品需求文档。详细描述产品功能、需求和验收标准的文档。
- **Product Brief**：产品简报。概述产品愿景、目标和范围的高层文档。
- **Architecture doc**：架构文档。描述系统架构、组件设计和技术决策的文档。
- **Epic/Story**：史诗/故事。敏捷开发中的工作单元，Epic 是大型功能集合，Story 是具体用户故事。
- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **Scope Creep**：范围蔓延。项目范围在开发过程中逐渐扩大，超出原始计划的现象。
- **tech-spec**：技术规范。详细描述技术实现方案、任务分解和验收标准的文档。
- **slug**：短标识符。用于生成 URL 或文件名的简短、唯一的字符串标识。
- **Given/When/Then**：一种行为驱动开发（BDD）的测试场景描述格式，用于定义验收标准。
- **adversarial review**：对抗性审查。一种代码审查方法，模拟攻击者视角以发现潜在问题和漏洞。
- **elicitation**：启发式方法。通过提问和对话引导来获取信息、澄清需求的技术。
- **stakeholder**：利益相关者。对项目有利益或影响的个人或组织。
- **API contracts**：API 契约。定义 API 接口规范、请求/响应格式和行为约定的文档。
- **service boundaries**：服务边界。定义服务职责范围和边界的架构概念。
- **spikes**：探索性开发。用于探索技术可行性或解决方案的短期研究活动。
</document>

<document path="zh-cn/explanation/why-solutioning-matters.md">
阶段 3（解决方案）将构建**什么**（来自规划）转化为**如何**构建（技术设计）。该阶段通过在实施开始前记录架构决策，防止多史诗项目中的智能体冲突。

## 没有解决方案阶段的问题

```text
智能体 1 使用 REST API 实现史诗 1
智能体 2 使用 GraphQL 实现史诗 2
结果：API 设计不一致，集成噩梦
```

当多个智能体在没有共享架构指导的情况下实现系统的不同部分时，它们会做出可能冲突的独立技术决策。

## 有解决方案阶段的解决方案

```text
架构工作流决定："所有 API 使用 GraphQL"
所有智能体遵循架构决策
结果：实现一致，无冲突
```

通过明确记录技术决策，所有智能体都能一致地实现，集成变得简单直接。

## 解决方案阶段 vs 规划阶段

| 方面 | 规划（阶段 2） | 解决方案（阶段 3） |
| -------- | ----------------------- | --------------------------------- |
| 问题 | 做什么和为什么？ | 如何做？然后是什么工作单元？ |
| 输出 | FRs/NFRs（需求） | 架构 + 史诗/用户故事 |
| 智能体 | PM | 架构师 → PM |
| 受众 | 利益相关者 | 开发人员 |
| 文档 | PRD（FRs/NFRs） | 架构 + 史诗文件 |
| 层级 | 业务逻辑 | 技术设计 + 工作分解 |

## 核心原则

**使技术决策明确且有文档记录**，以便所有智能体一致地实现。

这可以防止：
- API 风格冲突（REST vs GraphQL）
- 数据库设计不一致
- 状态管理分歧
- 命名约定不匹配
- 安全方法差异

## 何时需要解决方案阶段

| 流程 | 需要解决方案阶段？ |
|-------|----------------------|
| Quick Flow | 否 - 完全跳过 |
| BMad Method Simple | 可选 |
| BMad Method Complex | 是 |
| Enterprise | 是 |

:::tip[经验法则]
如果你有多个可能由不同智能体实现的史诗，你需要解决方案阶段。
:::

## 跳过的代价

在复杂项目中跳过解决方案阶段会导致：

- **集成问题**在冲刺中期发现
- **返工**由于实现冲突
- **开发时间更长**整体
- **技术债务**来自不一致模式

:::caution[成本倍增]
在解决方案阶段发现对齐问题比在实施期间发现要快 10 倍。
:::

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **epic**：史诗。在敏捷开发中，指一个大型的工作项，可分解为多个用户故事。
- **REST API**：表述性状态传递应用程序接口。一种基于 HTTP 协议的 Web API 设计风格。
- **GraphQL**：一种用于 API 的查询语言和运行时环境。
- **FRs/NFRs**：功能需求/非功能需求。Functional Requirements/Non-Functional Requirements 的缩写。
- **PRD**：产品需求文档。Product Requirements Document 的缩写。
- **PM**：产品经理。Product Manager 的缩写。
- **sprint**：冲刺。敏捷开发中的固定时间周期，通常为 1-4 周。
- **technical debt**：技术债务。指为了短期目标而选择的不完美技术方案，未来需要付出额外成本来修复。
</document>

<document path="zh-cn/how-to/customize-bmad.md">
使用 `.customize.yaml` 文件来调整智能体行为、角色和菜单，同时在更新过程中保留您的更改。

## 何时使用此功能

- 您想要更改智能体的名称、个性或沟通风格
- 您需要智能体记住项目特定的上下文
- 您想要添加自定义菜单项来触发您自己的工作流或提示
- 您希望智能体在每次启动时执行特定操作

:::note[前置条件]
- 在项目中安装了 BMad（参见[如何安装 BMad](./install-bmad.md)）
- 用于编辑 YAML 文件的文本编辑器
:::

:::caution[保护您的自定义配置]
始终使用此处描述的 `.customize.yaml` 文件，而不是直接编辑智能体文件。安装程序在更新期间会覆盖智能体文件，但会保留您的 `.customize.yaml` 更改。
:::

## 步骤

### 1. 定位自定义文件

安装后，在以下位置为每个智能体找到一个 `.customize.yaml` 文件：

```text
_bmad/_config/agents/
├── core-bmad-master.customize.yaml
├── bmm-dev.customize.yaml
├── bmm-pm.customize.yaml
└── ...（每个已安装的智能体一个文件）
```

### 2. 编辑自定义文件

打开您想要修改的智能体的 `.customize.yaml` 文件。每个部分都是可选的——只自定义您需要的内容。

| 部分               | 行为     | 用途                                           |
| ------------------ | -------- | ---------------------------------------------- |
| `agent.metadata`   | 替换     | 覆盖智能体的显示名称                           |
| `persona`          | 替换     | 设置角色、身份、风格和原则                     |
| `memories`         | 追加     | 添加智能体始终会记住的持久上下文               |
| `menu`             | 追加     | 为工作流或提示添加自定义菜单项                 |
| `critical_actions` | 追加     | 定义智能体的启动指令                           |
| `prompts`          | 追加     | 创建可重复使用的提示供菜单操作使用             |

标记为 **替换** 的部分会完全覆盖智能体的默认设置。标记为 **追加** 的部分会添加到现有配置中。

**智能体名称**

更改智能体的自我介绍方式：

```yaml
agent:
  metadata:
    name: 'Spongebob' # 默认值："Amelia"
```

**角色**

替换智能体的个性、角色和沟通风格：

```yaml
persona:
  role: 'Senior Full-Stack Engineer'
  identity: 'Lives in a pineapple (under the sea)'
  communication_style: 'Spongebob annoying'
  principles:
    - 'Never Nester, Spongebob Devs hate nesting more than 2 levels deep'
    - 'Favor composition over inheritance'
```

`persona` 部分会替换整个默认角色，因此如果您设置它，请包含所有四个字段。

**记忆**

添加智能体将始终记住的持久上下文：

```yaml
memories:
  - 'Works at Krusty Krab'
  - 'Favorite Celebrity: David Hasslehoff'
  - 'Learned in Epic 1 that it is not cool to just pretend that tests have passed'
```

**菜单项**

向智能体的显示菜单添加自定义条目。每个条目需要一个 `trigger`、一个目标（`workflow` 路径或 `action` 引用）和一个 `description`：

```yaml
menu:
  - trigger: my-workflow
    workflow: 'my-custom/workflows/my-workflow.yaml'
    description: My custom workflow
  - trigger: deploy
    action: '#deploy-prompt'
    description: Deploy to production
```

**关键操作**

定义智能体启动时运行的指令：

```yaml
critical_actions:
  - 'Check the CI Pipelines with the XYZ Skill and alert user on wake if anything is urgently needing attention'
```

**自定义提示**

创建可重复使用的提示，菜单项可以通过 `action="#id"` 引用：

```yaml
prompts:
  - id: deploy-prompt
    content: |
      Deploy the current branch to production:
      1. Run all tests
      2. Build the project
      3. Execute deployment script
```

### 3. 应用您的更改

编辑后，重新编译智能体以应用更改：

```bash
npx bmad-method install
```

安装程序会检测现有安装并提供以下选项：

| Option                       | What It Does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| **Quick Update**             | 将所有模块更新到最新版本并重新编译所有智能体                 |
| **Recompile Agents**         | 仅应用自定义配置，不更新模块文件                             |
| **Modify BMad Installation** | 用于添加或删除模块的完整安装流程                             |

对于仅自定义配置的更改，**Recompile Agents** 是最快的选项。

## 故障排除

**更改未生效？**

- 运行 `npx bmad-method install` 并选择 **Recompile Agents** 以应用更改
- 检查您的 YAML 语法是否有效（缩进很重要）
- 验证您编辑的是该智能体正确的 `.customize.yaml` 文件

**智能体无法加载？**

- 使用在线 YAML 验证器检查 YAML 语法错误
- 确保在取消注释后没有留下空字段
- 尝试恢复到原始模板并重新构建

**需要重置智能体？**

- 清空或删除智能体的 `.customize.yaml` 文件
- 运行 `npx bmad-method install` 并选择 **Recompile Agents** 以恢复默认设置

## 工作流自定义

对现有 BMad Method 工作流和技能的自定义即将推出。

## 模块自定义

关于构建扩展模块和自定义现有模块的指南即将推出。

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **workflow**：工作流。指一系列有序的任务或步骤，用于完成特定目标。
- **persona**：角色。指智能体的身份、个性、沟通风格和行为原则的集合。
- **memory**：记忆。指智能体持久存储的上下文信息，用于在对话中保持连贯性。
- **critical action**：关键操作。指智能体启动时必须执行的指令或任务。
- **prompt**：提示。指发送给智能体的输入文本，用于引导其生成特定响应或执行特定操作。
</document>

<document path="zh-cn/how-to/established-projects.md">
在现有项目和遗留代码库上工作时，有效使用 BMad Method。

本指南涵盖了使用 BMad Method 接入现有项目的核心工作流程。

:::note[前置条件]
- 已安装 BMad Method（`npx bmad-method install`）
- 一个你想要处理的现有代码库
- 访问 AI 驱动的 IDE（Claude Code 或 Cursor）
:::

## 步骤 1：清理已完成的规划产物

如果你通过 BMad 流程完成了所有 PRD 史诗和用户故事，请清理这些文件。归档它们、删除它们，或者在需要时依赖版本历史。不要将这些文件保留在：

- `docs/`
- `_bmad-output/planning-artifacts/`
- `_bmad-output/implementation-artifacts/`

## 步骤 2：创建项目上下文

:::tip[推荐用于既有项目]
生成 `project-context.md` 以捕获你现有代码库的模式和约定。这确保 AI 智能体在实施变更时遵循你既定的实践。
:::

运行生成项目上下文工作流程：

```bash
/bmad-bmm-generate-project-context
```

这将扫描你的代码库以识别：
- 技术栈和版本
- 代码组织模式
- 命名约定
- 测试方法
- 框架特定模式

你可以查看和完善生成的文件，或者如果你更喜欢，可以在 `_bmad-output/project-context.md` 手动创建它。

[了解更多关于项目上下文](../explanation/project-context.md)

## 步骤 3：维护高质量项目文档

你的 `docs/` 文件夹应包含简洁、组织良好的文档，准确代表你的项目：

- 意图和业务理由
- 业务规则
- 架构
- 任何其他相关的项目信息

对于复杂项目，考虑使用 `document-project` 工作流程。它提供运行时变体，将扫描你的整个项目并记录其实际当前状态。

## 步骤 3：获取帮助

### BMad-Help：你的起点

**随时运行 `/bmad-help`，当你不确定下一步该做什么时。** 这个智能指南：

- 检查你的项目以查看已经完成了什么
- 根据你安装的模块显示选项
- 理解自然语言查询

```
/bmad-help 我有一个现有的 Rails 应用，我应该从哪里开始？
/bmad-help quick-flow 和完整方法有什么区别？
/bmad-help 显示我有哪些可用的工作流程
```

BMad-Help 还会在**每个工作流程结束时自动运行**，提供关于下一步该做什么的清晰指导。

### 选择你的方法

根据变更范围，你有两个主要选项：

| 范围                          | 推荐方法                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **小型更新或添加** | 使用 `quick-flow-solo-dev` 创建技术规范并实施变更。完整的四阶段 BMad Method 可能有些过度。 |
| **重大变更或添加** | 从 BMad Method 开始，根据需要应用或多或少的严谨性。                                                    |

### 在创建 PRD 期间

在创建简报或直接进入 PRD 时，确保智能体：

- 查找并分析你现有的项目文档
- 阅读关于你当前系统的适当上下文

你可以明确地指导智能体，但目标是确保新功能与你的现有系统良好集成。

### UX 考量

UX 工作是可选的。决定不取决于你的项目是否有 UX，而取决于：

- 你是否将处理 UX 变更
- 是否需要重要的新 UX 设计或模式

如果你的变更只是对你满意的现有屏幕进行简单更新，则不需要完整的 UX 流程。

### 架构考量

在进行架构工作时，确保架构师：

- 使用适当的已记录文件
- 扫描现有代码库

在此处要密切注意，以防止重新发明轮子或做出与你现有架构不一致的决定。

## 更多信息

- **[快速修复](./quick-fixes.md)** - 错误修复和临时变更
- **[既有项目 FAQ](../explanation/established-projects-faq.md)** - 关于在既有项目上工作的常见问题

---
## 术语说明

- **BMad Method**：BMad 方法。一种结构化的软件开发方法论，用于指导从分析到实施的完整流程。
- **PRD**：产品需求文档（Product Requirements Document）。描述产品功能、需求和目标的文档。
- **epic**：史诗。大型功能或用户故事的集合，通常需要较长时间完成。
- **story**：用户故事。描述用户需求的简短陈述，通常遵循"作为...我想要...以便于..."的格式。
- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **IDE**：集成开发环境（Integrated Development Environment）。提供代码编辑、调试、构建等功能的软件工具。
- **UX**：用户体验（User Experience）。用户在使用产品或服务过程中的整体感受和交互体验。
- **tech-spec**：技术规范（Technical Specification）。描述技术实现细节、架构设计和开发标准的文档。
- **quick-flow**：快速流程。BMad Method 中的一种简化工作流程，适用于小型变更或快速迭代。
- **legacy codebase**：遗留代码库。指历史遗留的、可能缺乏文档或使用过时技术的代码集合。
- **project context**：项目上下文。描述项目技术栈、约定、模式等背景信息的文档。
- **artifact**：产物。在开发过程中生成的文档、代码或其他输出物。
- **runtime variant**：运行时变体。在程序运行时可选择或切换的不同实现方式或配置。
</document>

<document path="zh-cn/how-to/get-answers-about-bmad.md">
## 从这里开始：BMad-Help

**获取关于 BMad 答案的最快方式是 `/bmad-help`。** 这个智能指南可以回答超过 80% 的问题，并且直接在您的 IDE 中可用，方便您工作时使用。

BMad-Help 不仅仅是一个查询工具——它：
- **检查您的项目**以查看已完成的内容
- **理解自然语言**——用简单的英语提问
- **根据您安装的模块变化**——显示相关选项
- **在工作流后自动运行**——告诉您接下来该做什么
- **推荐第一个必需任务**——无需猜测从哪里开始

### 如何使用 BMad-Help

只需使用斜杠命令运行它：

```
/bmad-help
```

或者结合自然语言查询：

```
/bmad-help 我有一个 SaaS 想法并且知道所有功能。我应该从哪里开始？
/bmad-help 我在 UX 设计方面有哪些选择？
/bmad-help 我在 PRD 工作流上卡住了
/bmad-help 向我展示到目前为止已完成的内容
```

BMad-Help 会回应：
- 针对您情况的建议
- 第一个必需任务是什么
- 流程的其余部分是什么样的

---

## 何时使用本指南

在以下情况下使用本节：
- 您想了解 BMad 的架构或内部机制
- 您需要 BMad-Help 提供范围之外的答案
- 您在安装前研究 BMad
- 您想直接探索源代码

## 步骤

### 1. 选择您的来源

| 来源               | 最适合用于                                  | 示例                     |
| -------------------- | ----------------------------------------- | ---------------------------- |
| **`_bmad` 文件夹**   | BMad 如何工作——智能体、工作流、提示词 | "PM 智能体做什么？" |
| **完整的 GitHub 仓库** | 历史、安装程序、架构          | "v6 中有什么变化？"        |
| **`llms-full.txt`**  | 来自文档的快速概述                  | "解释 BMad 的四个阶段" |

`_bmad` 文件夹在您安装 BMad 时创建。如果您还没有它，请改为克隆仓库。

### 2. 将您的 AI 指向来源

**如果您的 AI 可以读取文件（Claude Code、Cursor 等）：**

- **已安装 BMad：** 指向 `_bmad` 文件夹并直接提问
- **想要更深入的上下文：** 克隆[完整仓库](https://github.com/bmad-code-org/BMAD-METHOD)

**如果您使用 ChatGPT 或 Claude.ai：**

将 `llms-full.txt` 获取到您的会话中：

```text
https://bmad-code-org.github.io/BMAD-METHOD/llms-full.txt
```


### 3. 提出您的问题

:::note[示例]
**问：** "告诉我用 BMad 构建某物的最快方式"

**答：** 使用快速流程：运行 `quick-spec` 编写技术规范，然后运行 `quick-dev` 实现它——跳过完整的规划阶段。
:::

## 您将获得什么

关于 BMad 的直接答案——智能体如何工作、工作流做什么、为什么事物以这种方式构建——无需等待其他人回应。

## 提示

- **验证令人惊讶的答案**——LLM 偶尔会出错。检查源文件或在 Discord 上询问。
- **具体化**——"PRD 工作流的第 3 步做什么？"比"PRD 如何工作？"更好

## 仍然卡住了？

尝试了 LLM 方法但仍需要帮助？您现在有一个更好的问题可以问。

| 频道                   | 用于                                     |
| ------------------------- | ------------------------------------------- |
| `#bmad-method-help`       | 快速问题（实时聊天）            |
| `help-requests` 论坛     | 详细问题（可搜索、持久） |
| `#suggestions-feedback`   | 想法和功能请求                  |
| `#report-bugs-and-issues` | 错误报告                                 |

**Discord：** [discord.gg/gk8jAdXWmj](https://discord.gg/gk8jAdXWmj)

**GitHub Issues：** [github.com/bmad-code-org/BMAD-METHOD/issues](https://github.com/bmad-code-org/BMAD-METHOD/issues)（用于明确的错误）

*你！*
        *卡住*
              *在队列中——*
                       *等待*
                               *等待谁？*

*来源*
        *就在那里，*
                *显而易见！*

*指向*
      *你的机器。*
               *释放它。*

*它读取。*
         *它说话。*
                 *尽管问——*

*为什么要等*
         *明天*
                 *当你拥有*
                         *今天？*

*—Claude*

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **LLM**：大语言模型。基于深度学习的自然语言处理模型，能够理解和生成人类语言。
- **SaaS**：软件即服务。一种通过互联网提供软件应用的交付模式。
- **UX**：用户体验。用户在使用产品或服务过程中建立的主观感受和评价。
- **PRD**：产品需求文档。详细描述产品功能、特性和需求的正式文档。
- **IDE**：集成开发环境。提供代码编辑、调试、构建等功能的软件开发工具。
</document>

<document path="zh-cn/how-to/install-bmad.md">
使用 `npx bmad-method install` 命令在项目中设置 BMad，并选择你需要的模块和 AI 工具。

如果你想使用非交互式安装程序并在命令行中提供所有安装选项，请参阅[本指南](./non-interactive-installation.md)。

## 何时使用

- 使用 BMad 启动新项目
- 将 BMad 添加到现有代码库
- 更新现有的 BMad 安装

:::note[前置条件]
- **Node.js** 20+（安装程序必需）
- **Git**（推荐）
- **AI 工具**（Claude Code、Cursor 或类似工具）
:::

## 步骤

### 1. 运行安装程序

```bash
npx bmad-method install
```

:::tip[最新版本]
要从主分支安装最新版本（可能不稳定）：
```bash
npx github:bmad-code-org/BMAD-METHOD install
```
:::

### 2. 选择安装位置

安装程序会询问在哪里安装 BMad 文件：

- 当前目录（如果你自己创建了目录并从该目录运行，推荐用于新项目）
- 自定义路径

### 3. 选择你的 AI 工具

选择你使用的 AI 工具：

- Claude Code
- Cursor
- 其他

每个工具都有自己的命令集成方式。安装程序会创建微小的提示文件来激活工作流和智能体——它只是将它们放在工具期望找到的位置。

### 4. 选择模块

安装程序会显示可用的模块。选择你需要的模块——大多数用户只需要 **BMad Method**（软件开发模块）。

### 5. 按照提示操作

安装程序会引导你完成剩余步骤——自定义内容、设置等。

## 你将获得

```text
your-project/
├── _bmad/
│   ├── bmm/            # 你选择的模块
│   │   └── config.yaml # 模块设置（如果你需要更改它们）
│   ├── core/           # 必需的核心模块
│   └── ...
├── _bmad-output/       # 生成的工件
├── .claude/            # Claude Code 命令（如果使用 Claude Code）
└── .kiro/              # Kiro 引导文件（如果使用 Kiro）
```

## 验证安装

运行 `/bmad-help` 来验证一切正常并查看下一步操作。

**BMad-Help 是你的智能向导**，它会：
- 确认你的安装正常工作
- 根据你安装的模块显示可用内容
- 推荐你的第一步

你也可以向它提问：
```
/bmad-help 我刚安装完成，应该先做什么？
/bmad-help 对于 SaaS 项目我有哪些选项？
```

## 故障排除

**安装程序抛出错误**——将输出复制粘贴到你的 AI 助手中，让它来解决问题。

**安装程序工作正常但后续出现问题**——你的 AI 需要 BMad 上下文才能提供帮助。请参阅[如何获取关于 BMad 的答案](./get-answers-about-bmad.md)了解如何将你的 AI 指向正确的来源。

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **workflow**：工作流。指一系列有序的任务或步骤，用于完成特定目标。
- **module**：模块。指软件系统中可独立开发、测试和维护的功能单元。
- **artifact**：工件。指在软件开发过程中生成的任何输出，如文档、代码、配置文件等。
</document>

<document path="zh-cn/how-to/non-interactive-installation.md">
使用命令行标志以非交互方式安装 BMad。这适用于：

## 使用场景

- 自动化部署和 CI/CD 流水线
- 脚本化安装
- 跨多个项目的批量安装
- 使用已知配置的快速安装

:::note[前置条件]
需要 [Node.js](https://nodejs.org) v20+ 和 `npx`（随 npm 附带）。
:::

## 可用标志

### 安装选项

| 标志 | 描述 | 示例 |
|------|-------------|---------|
| `--directory <path>` | 安装目录 | `--directory ~/projects/myapp` |
| `--modules <modules>` | 逗号分隔的模块 ID | `--modules bmm,bmb` |
| `--tools <tools>` | 逗号分隔的工具/IDE ID（使用 `none` 跳过） | `--tools claude-code,cursor` 或 `--tools none` |
| `--custom-content <paths>` | 逗号分隔的自定义模块路径 | `--custom-content ~/my-module,~/another-module` |
| `--action <type>` | 对现有安装的操作：`install`（默认）、`update`、`quick-update` 或 `compile-agents` | `--action quick-update` |

### 核心配置

| 标志 | 描述 | 默认值 |
|------|-------------|---------|
| `--user-name <name>` | 智能体使用的名称 | 系统用户名 |
| `--communication-language <lang>` | 智能体通信语言 | 英语 |
| `--document-output-language <lang>` | 文档输出语言 | 英语 |
| `--output-folder <path>` | 输出文件夹路径 | _bmad-output |

### 其他选项

| 标志 | 描述 |
|------|-------------|
| `-y, --yes` | 接受所有默认值并跳过提示 |
| `-d, --debug` | 启用清单生成的调试输出 |

## 模块 ID

`--modules` 标志可用的模块 ID：

- `bmm` — BMad Method Master
- `bmb` — BMad Builder

查看 [BMad 注册表](https://github.com/bmad-code-org) 获取可用的外部模块。

## 工具/IDE ID

`--tools` 标志可用的工具 ID：

**推荐：** `claude-code`、`cursor`

运行一次 `npx bmad-method install` 交互式安装以查看完整的当前支持工具列表，或查看 [平台代码配置](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/tools/cli/installers/lib/ide/platform-codes.yaml)。

## 安装模式

| 模式 | 描述 | 示例 |
|------|-------------|---------|
| 完全非交互式 | 提供所有标志以跳过所有提示 | `npx bmad-method install --directory . --modules bmm --tools claude-code --yes` |
| 半交互式 | 提供部分标志；BMad 提示其余部分 | `npx bmad-method install --directory . --modules bmm` |
| 仅使用默认值 | 使用 `-y` 接受所有默认值 | `npx bmad-method install --yes` |
| 不包含工具 | 跳过工具/IDE 配置 | `npx bmad-method install --modules bmm --tools none` |

## 示例

### CI/CD 流水线安装

```bash
#!/bin/bash
# install-bmad.sh

npx bmad-method install \
  --directory "${GITHUB_WORKSPACE}" \
  --modules bmm \
  --tools claude-code \
  --user-name "CI Bot" \
  --communication-language English \
  --document-output-language English \
  --output-folder _bmad-output \
  --yes
```

### 更新现有安装

```bash
npx bmad-method install \
  --directory ~/projects/myapp \
  --action update \
  --modules bmm,bmb,custom-module
```

### 快速更新（保留设置）

```bash
npx bmad-method install \
  --directory ~/projects/myapp \
  --action quick-update
```

### 使用自定义内容安装

```bash
npx bmad-method install \
  --directory ~/projects/myapp \
  --modules bmm \
  --custom-content ~/my-custom-module,~/another-module \
  --tools claude-code
```

## 安装结果

- 项目中完全配置的 `_bmad/` 目录
- 为所选模块和工具编译的智能体和工作流
- 用于生成产物的 `_bmad-output/` 文件夹

## 验证和错误处理

BMad 会验证所有提供的标志：

- **目录** — 必须是具有写入权限的有效路径
- **模块** — 对无效的模块 ID 发出警告（但不会失败）
- **工具** — 对无效的工具 ID 发出警告（但不会失败）
- **自定义内容** — 每个路径必须包含有效的 `module.yaml` 文件
- **操作** — 必须是以下之一：`install`、`update`、`quick-update`、`compile-agents`

无效值将：
1. 显示错误并退出（对于目录等关键选项）
2. 显示警告并跳过（对于自定义内容等可选项目）
3. 回退到交互式提示（对于缺失的必需值）

:::tip[最佳实践]
- 为 `--directory` 使用绝对路径以避免歧义
- 在 CI/CD 流水线中使用前先在本地测试标志
- 结合 `-y` 实现真正的无人值守安装
- 如果在安装过程中遇到问题，使用 `--debug`
:::

## 故障排除

### 安装失败，提示"Invalid directory"

- 目录路径必须存在（或其父目录必须存在）
- 您需要写入权限
- 路径必须是绝对路径或相对于当前目录的正确相对路径

### 未找到模块

- 验证模块 ID 是否正确
- 外部模块必须在注册表中可用

### 自定义内容路径无效

确保每个自定义内容路径：
- 指向一个目录
- 在根目录中包含 `module.yaml` 文件
- 在 `module.yaml` 中有 `code` 字段

:::note[仍然卡住了？]
使用 `--debug` 运行以获取详细输出，尝试交互模式以隔离问题，或在 <https://github.com/bmad-code-org/BMAD-METHOD/issues> 报告。
:::

---
## 术语说明

- **CI/CD**：持续集成/持续部署。一种自动化软件开发流程的实践，用于频繁集成代码更改并自动部署到生产环境。
- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **module**：模块。软件系统中可独立开发、测试和维护的功能单元。
- **IDE**：集成开发环境。提供代码编辑、调试、构建等功能的软件开发工具。
- **npx**：Node Package eXecute。npm 包执行器，用于直接执行 npm 包而无需全局安装。
- **workflow**：工作流。一系列有序的任务或步骤，用于完成特定的业务流程或开发流程。
</document>

<document path="zh-cn/how-to/project-context.md">
使用 `project-context.md` 文件确保 AI 智能体在所有工作流程中遵循项目的技术偏好和实现规则。

:::note[前置条件]
- 已安装 BMad Method
- 了解项目的技术栈和约定
:::

## 何时使用

- 在开始架构设计之前有明确的技术偏好
- 已完成架构设计并希望为实施捕获决策
- 正在处理具有既定模式的现有代码库
- 注意到智能体在不同用户故事中做出不一致的决策

## 步骤 1：选择方法

**手动创建** — 当您确切知道要记录哪些规则时最佳

**架构后生成** — 最适合捕获解决方案制定过程中所做的决策

**为现有项目生成** — 最适合在现有代码库中发现模式

## 步骤 2：创建文件

### 选项 A：手动创建

在 `_bmad-output/project-context.md` 创建文件：

```bash
mkdir -p _bmad-output
touch _bmad-output/project-context.md
```

添加技术栈和实现规则：

```markdown
---
project_name: 'MyProject'
user_name: 'YourName'
date: '2026-02-15'
sections_completed: ['technology_stack', 'critical_rules']
---

# AI 智能体的项目上下文

## 技术栈与版本

- Node.js 20.x, TypeScript 5.3, React 18.2
- 状态管理：Zustand
- 测试：Vitest, Playwright
- 样式：Tailwind CSS

## 关键实现规则

**TypeScript：**
- 启用严格模式，不使用 `any` 类型
- 公共 API 使用 `interface`，联合类型使用 `type`

**代码组织：**
- 组件位于 `/src/components/` 并附带同位置测试
- API 调用使用 `apiClient` 单例 — 绝不直接使用 fetch

**测试：**
- 单元测试专注于业务逻辑
- 集成测试使用 MSW 进行 API 模拟
```

### 选项 B：架构后生成

在新的聊天中运行工作流程：

```bash
/bmad-bmm-generate-project-context
```

工作流程扫描架构文档和项目文件，生成捕获所做决策的上下文文件。

### 选项 C：为现有项目生成

对于现有项目，运行：

```bash
/bmad-bmm-generate-project-context
```

工作流程分析代码库以识别约定，然后生成上下文文件供您审查和完善。

## 步骤 3：验证内容

审查生成的文件并确保它捕获了：

- 正确的技术版本
- 实际约定（而非通用最佳实践）
- 防止常见错误的规则
- 框架特定的模式

手动编辑以添加任何缺失内容或删除不准确之处。

## 您将获得

一个 `project-context.md` 文件，它：

- 确保所有智能体遵循相同的约定
- 防止在不同用户故事中做出不一致的决策
- 为实施捕获架构决策
- 作为项目模式和规则的参考

## 提示

:::tip[关注非显而易见的内容]
记录智能体可能遗漏的模式，例如"在每个公共类、函数和变量上使用 JSDoc 风格注释"，而不是像"使用有意义的变量名"这样的通用实践，因为 LLM 目前已经知道这些。
:::

:::tip[保持精简]
此文件由每个实施工作流程加载。长文件会浪费上下文。不要包含仅适用于狭窄范围或特定用户故事或功能的内容。
:::

:::tip[根据需要更新]
当模式发生变化时手动编辑，或在重大架构更改后重新生成。
:::

:::tip[适用于所有项目类型]
对于快速流程和完整的 BMad Method 项目同样有用。
:::

## 后续步骤

- [**项目上下文说明**](../explanation/project-context.md) — 了解其工作原理
- [**工作流程图**](../reference/workflow-map.md) — 查看哪些工作流程加载项目上下文

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **workflow**：工作流程。指完成特定任务的一系列步骤或过程。
- **codebase**：代码库。指项目的所有源代码和资源的集合。
- **implementation**：实施。指将设计或架构转化为实际代码的过程。
- **architecture**：架构。指系统的整体结构和设计。
- **stack**：技术栈。指项目使用的技术组合，如编程语言、框架、工具等。
- **convention**：约定。指团队或项目中遵循的编码规范和最佳实践。
- **singleton**：单例。一种设计模式，确保类只有一个实例。
- **co-located**：同位置。指相关文件（如测试文件）与主文件放在同一目录中。
- **mocking**：模拟。在测试中用模拟对象替代真实对象的行为。
- **context**：上下文。指程序运行时的环境信息或背景信息。
- **LLM**：大语言模型。Large Language Model 的缩写，指大型语言模型。
</document>

<document path="zh-cn/how-to/quick-fixes.md">
直接使用 **DEV 智能体**进行 bug 修复、重构或小型针对性更改，这些操作不需要完整的 BMad Method 或 Quick Flow。

## 何时使用此方法

- 原因明确且已知的 bug 修复
- 包含在少数文件中的小型重构（重命名、提取、重组）
- 次要功能调整或配置更改
- 探索性工作，以了解不熟悉的代码库

:::note[前置条件]
- 已安装 BMad Method（`npx bmad-method install`）
- AI 驱动的 IDE（Claude Code、Cursor 或类似工具）
:::

## 选择你的方法

| 情况 | 智能体 | 原因 |
| --- | --- | --- |
| 修复特定 bug 或进行小型、范围明确的更改 | **DEV agent** | 直接进入实现，无需规划开销 |
| 更改涉及多个文件，或希望先有书面计划 | **Quick Flow Solo Dev** | 在实现前创建 quick-spec，使智能体与你的标准保持一致 |

如果不确定，请从 DEV 智能体开始。如果更改范围扩大，你始终可以升级到 Quick Flow。

## 步骤

### 1. 加载 DEV 智能体

在 AI IDE 中启动一个**新的聊天**，并使用斜杠命令加载 DEV 智能体：

```text
/bmad-agent-bmm-dev
```

这会将智能体的角色和能力加载到会话中。如果你决定需要 Quick Flow，请在新的聊天中加载 **Quick Flow Solo Dev** 智能体：

```text
/bmad-agent-bmm-quick-flow-solo-dev
```

加载 Solo Dev 智能体后，描述你的更改并要求它创建一个 **quick-spec**。智能体会起草一个轻量级规范，捕获你想要更改的内容和方式。批准 quick-spec 后，告诉智能体开始 **Quick Flow 开发周期**——它将实现更改、运行测试并执行自我审查，所有这些都由你刚刚批准的规范指导。

:::tip[新聊天]
加载智能体时始终启动新的聊天会话。重用之前工作流的会话可能导致上下文冲突。
:::

### 2. 描述更改

用通俗语言告诉智能体你需要什么。具体说明问题，如果你知道相关代码的位置，也请说明。

:::note[示例提示词]
**Bug 修复** -- "修复允许空密码的登录验证 bug。验证逻辑位于 `src/auth/validate.ts`。"

**重构** -- "重构 UserService 以使用 async/await 而不是回调。"

**配置更改** -- "更新 CI 流水线以在运行之间缓存 node_modules。"

**依赖更新** -- "将 express 依赖升级到最新的 v5 版本并修复任何破坏性更改。"
:::

你不需要提供每个细节。智能体会读取相关的源文件，并在需要时提出澄清问题。

### 3. 让智能体工作

智能体将：

- 读取并分析相关的源文件
- 提出解决方案并解释其推理
- 在受影响的文件中实现更改
- 如果存在测试套件，则运行项目的测试套件

如果你的项目有测试，智能体会在进行更改后自动运行它们，并迭代直到测试通过。对于没有测试套件的项目，请手动验证更改（运行应用、访问端点、检查输出）。

### 4. 审查和验证

在提交之前，审查更改内容：

- 通读 diff 以确认更改符合你的意图
- 自己运行应用程序或测试以再次检查
- 如果看起来有问题，告诉智能体需要修复什么——它可以在同一会话中迭代

满意后，使用描述修复的清晰消息提交更改。

:::caution[如果出现问题]
如果提交的更改导致意外问题，请使用 `git revert HEAD` 干净地撤销最后一次提交。然后启动与 DEV 智能体的新聊天以尝试不同的方法。
:::

## 学习你的代码库

DEV 智能体也适用于探索不熟悉的代码。在新的聊天中加载它并提出问题：

:::note[示例提示词]
"解释此代码库中的身份验证系统是如何工作的。"

"向我展示 API 层中的错误处理发生在哪里。"

"`ProcessOrder` 函数的作用是什么，什么调用了它？"
:::

使用智能体了解你的项目，理解组件如何连接，并在进行更改之前探索不熟悉的区域。

## 你将获得

- 已应用修复或重构的修改后的源文件
- 通过的测试（如果你的项目有测试套件）
- 描述更改的干净提交

不会生成规划产物——这就是这种方法的意义所在。

## 何时升级到正式规划

在以下情况下考虑使用 [Quick Flow](../explanation/quick-flow.md) 或完整的 BMad Method：

- 更改影响多个系统或需要在许多文件中进行协调更新
- 你不确定范围，需要规范来理清思路
- 修复在工作过程中变得越来越复杂
- 你需要为团队记录文档或架构决策

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **quick-spec**：快速规范。一种轻量级的规范文档，用于快速捕获和描述更改的内容和方式。
- **Quick Flow**：快速流程。BMad Method 中的一种工作流程，用于快速实现小型更改。
- **refactoring**：重构。在不改变代码外部行为的情况下改进其内部结构的过程。
- **breaking changes**：破坏性更改。可能导致现有代码或功能不再正常工作的更改。
- **test suite**：测试套件。一组用于验证软件功能的测试用例集合。
- **CI pipeline**：CI 流水线。持续集成流水线，用于自动化构建、测试和部署代码。
- **async/await**：异步编程语法。JavaScript/TypeScript 中用于处理异步操作的语法糖。
- **callbacks**：回调函数。作为参数传递给其他函数并在适当时候被调用的函数。
- **endpoint**：端点。API 中可访问的特定 URL 路径。
- **diff**：差异。文件或代码更改前后的对比。
- **commit**：提交。将更改保存到版本控制系统的操作。
- **git revert HEAD**：Git 命令，用于撤销最后一次提交。
</document>

<document path="zh-cn/how-to/shard-large-documents.md">
如果需要将大型 Markdown 文件拆分为更小、组织良好的文件以更好地管理上下文，请使用 `shard-doc` 工具。

:::caution[已弃用]
不再推荐使用此方法，随着工作流程的更新以及大多数主要 LLM 和工具支持子进程，这很快将变得不再必要。
:::

## 何时使用

仅当你发现所选工具/模型组合无法在需要时加载和读取所有文档作为输入时，才使用此方法。

## 什么是文档分片？

文档分片根据二级标题（`## Heading`）将大型 Markdown 文件拆分为更小、组织良好的文件。

### 架构

```text
分片前：
_bmad-output/planning-artifacts/
└── PRD.md（大型 50k token 文件）

分片后：
_bmad-output/planning-artifacts/
└── prd/
    ├── index.md                    # 带有描述的目录
    ├── overview.md                 # 第 1 节
    ├── user-requirements.md        # 第 2 节
    ├── technical-requirements.md   # 第 3 节
    └── ...                         # 其他章节
```

## 步骤

### 1. 运行 Shard-Doc 工具

```bash
/bmad-shard-doc
```

### 2. 遵循交互式流程

```text
智能体：您想要分片哪个文档？
用户：docs/PRD.md

智能体：默认目标位置：docs/prd/
       接受默认值？[y/n]
用户：y

智能体：正在分片 PRD.md...
       ✓ 已创建 12 个章节文件
       ✓ 已生成 index.md
       ✓ 完成！
```

## 工作流程发现机制

BMad 工作流程使用**双重发现系统**：

1. **首先尝试完整文档** - 查找 `document-name.md`
2. **检查分片版本** - 查找 `document-name/index.md`
3. **优先级规则** - 如果两者都存在，完整文档优先 - 如果希望使用分片版本，请删除完整文档

## 工作流程支持

所有 BMM 工作流程都支持这两种格式：

- 完整文档
- 分片文档
- 自动检测
- 对用户透明

---
## 术语说明

- **sharding**：分片。将大型文档或数据集拆分为更小、更易管理的部分的过程。
- **token**：令牌。在自然语言处理和大型语言模型中，文本的基本单位，通常对应单词或字符的一部分。
- **subprocesses**：子进程。由主进程创建的独立执行单元，可以并行运行以执行特定任务。
- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
</document>

<document path="zh-cn/how-to/upgrade-to-v6.md">
使用 BMad 安装程序从 v4 升级到 v6，其中包括自动检测旧版安装和迁移辅助。

## 何时使用本指南

- 您已安装 BMad v4（`.bmad-method` 文件夹）
- 您希望迁移到新的 v6 架构
- 您有需要保留的现有规划产物

:::note[前置条件]
- Node.js 20+
- 现有的 BMad v4 安装
:::

## 步骤

### 1. 运行安装程序

按照[安装程序说明](./install-bmad.md)操作。

### 2. 处理旧版安装

当检测到 v4 时，您可以：

- 允许安装程序备份并删除 `.bmad-method`
- 退出并手动处理清理

如果您将 bmad method 文件夹命名为其他名称 - 您需要手动删除该文件夹。

### 3. 清理 IDE 命令

手动删除旧版 v4 IDE 命令 - 例如如果您使用 claude，查找任何以 bmad 开头的嵌套文件夹并删除它们：

- `.claude/commands/BMad/agents`
- `.claude/commands/BMad/tasks`

### 4. 迁移规划产物

**如果您有规划文档（Brief/PRD/UX/Architecture）：**

将它们移动到 `_bmad-output/planning-artifacts/` 并使用描述性名称：

- 在文件名中包含 `PRD` 用于 PRD 文档
- 相应地包含 `brief`、`architecture` 或 `ux-design`
- 分片文档可以放在命名的子文件夹中

**如果您正在进行规划：** 考虑使用 v6 工作流重新开始。将现有文档作为输入——新的渐进式发现工作流配合网络搜索和 IDE 计划模式会产生更好的结果。

### 5. 迁移进行中的开发

如果您已创建或实现了故事：

1. 完成 v6 安装
2. 将 `epics.md` 或 `epics/epic*.md` 放入 `_bmad-output/planning-artifacts/`
3. 运行 Scrum Master 的 `sprint-planning` 工作流
4. 告诉 SM 哪些史诗/故事已经完成

## 您将获得

**v6 统一结构：**

```text
your-project/
├── _bmad/               # 单一安装文件夹
│   ├── _config/         # 您的自定义配置
│   │   └── agents/      # 智能体自定义文件
│   ├── core/            # 通用核心框架
│   ├── bmm/             # BMad Method 模块
│   ├── bmb/             # BMad Builder
│   └── cis/             # Creative Intelligence Suite
└── _bmad-output/        # 输出文件夹（v4 中为 doc 文件夹）
```

## 模块迁移

| v4 模块                       | v6 状态                                   |
| ----------------------------- | ----------------------------------------- |
| `.bmad-2d-phaser-game-dev`    | 已集成到 BMGD 模块                        |
| `.bmad-2d-unity-game-dev`     | 已集成到 BMGD 模块                        |
| `.bmad-godot-game-dev`        | 已集成到 BMGD 模块                        |
| `.bmad-infrastructure-devops` | 已弃用 — 新的 DevOps 智能体即将推出       |
| `.bmad-creative-writing`      | 未适配 — 新的 v6 模块即将推出             |

## 主要变更

| 概念         | v4                                      | v6                                   |
| ------------ | --------------------------------------- | ------------------------------------ |
| **核心**     | `_bmad-core` 实际上是 BMad Method      | `_bmad/core/` 是通用框架             |
| **方法**     | `_bmad-method`                          | `_bmad/bmm/`                         |
| **配置**     | 直接修改文件                            | 每个模块使用 `config.yaml`           |
| **文档**     | 需要设置分片或非分片                    | 完全灵活，自动扫描                   |

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **epic**：史诗。在敏捷开发中，指大型的工作项，可分解为多个用户故事。
- **story**：故事。在敏捷开发中，指用户故事，描述用户需求的功能单元。
- **Scrum Master**：Scrum 主管。敏捷开发 Scrum 框架中的角色，负责促进团队流程和移除障碍。
- **sprint-planning**：冲刺规划。Scrum 框架中的会议，用于确定下一个冲刺期间要完成的工作。
- **sharded**：分片。将大型文档拆分为多个较小的文件以便于管理和处理。
- **PRD**：产品需求文档（Product Requirements Document）。描述产品功能、需求和特性的文档。
- **Brief**：简报。概述项目目标、范围和关键信息的文档。
- **UX**：用户体验（User Experience）。用户在使用产品或服务过程中的整体感受和交互体验。
- **Architecture**：架构。系统的结构设计，包括组件、模块及其相互关系。
- **BMGD**：BMad Game Development。BMad 游戏开发模块。
- **DevOps**：开发运维（Development Operations）。结合开发和运维的实践，旨在缩短系统开发生命周期。
- **BMad Method**：BMad 方法。BMad 框架的核心方法论模块。
- **BMad Builder**：BMad 构建器。BMad 框架的构建工具。
- **Creative Intelligence Suite**：创意智能套件。BMad 框架中的创意工具集合。
- **IDE**：集成开发环境（Integrated Development Environment）。提供代码编辑、调试等功能的软件开发工具。
- **progressive discovery**：渐进式发现。逐步深入探索和理解需求的过程。
- **web search**：网络搜索。通过互联网检索信息的能力。
- **plan mode**：计划模式。IDE 中的一种工作模式，用于规划和设计任务。
</document>

<document path="zh-cn/index.md">
BMad 方法（**B**reakthrough **M**ethod of **A**gile AI **D**riven Development，敏捷 AI 驱动开发的突破性方法）是 BMad 方法生态系统中的一个 AI 驱动开发框架模块，帮助您完成从构思和规划到智能体实现的整个软件开发过程。它提供专业的 AI 智能体、引导式工作流和智能规划，能够根据您项目的复杂度进行调整，无论是修复错误还是构建企业平台。

如果您熟悉使用 Claude、Cursor 或 GitHub Copilot 等 AI 编码助手，就可以开始使用了。

:::note[🚀 V6 已发布，我们才刚刚起步！]
技能架构、BMad Builder v1、开发循环自动化以及更多功能正在开发中。**[查看路线图 →](/roadmap/)**
:::

## 新手入门？从教程开始

理解 BMad 的最快方式是亲自尝试。

- **[BMad 入门指南](./tutorials/getting-started.md)** — 安装并了解 BMad 的工作原理
- **[工作流地图](./reference/workflow-map.md)** — BMM 阶段、工作流和上下文管理的可视化概览

:::tip[只想直接上手？]
安装 BMad 并运行 `/bmad-help` — 它会根据您的项目和已安装的模块引导您完成所有操作。
:::

## 如何使用本文档

本文档根据您的目标分为四个部分：

| 部分           | 用途                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **教程**     | 以学习为导向。通过分步指南引导您构建内容。如果您是新手，请从这里开始。 |
| **操作指南** | 以任务为导向。解决特定问题的实用指南。"如何自定义智能体？"等内容位于此处。  |
| **说明**   | 以理解为导向。深入探讨概念和架构。当您想知道*为什么*时阅读。       |
| **参考**     | 以信息为导向。智能体、工作流和配置的技术规范。                   |

## 扩展和自定义

想要使用自己的智能体、工作流或模块来扩展 BMad 吗？**[BMad Builder](https://bmad-builder-docs.bmad-method.org/)** 提供了创建自定义扩展的框架和工具，无论是为 BMad 添加新功能还是从头开始构建全新的模块。

## 您需要什么

BMad 可与任何支持自定义系统提示词或项目上下文的 AI 编码助手配合使用。热门选项包括：

- **[Claude Code](https://code.claude.com)** — Anthropic 的 CLI 工具（推荐）
- **[Cursor](https://cursor.sh)** — AI 优先的代码编辑器
- **[Codex CLI](https://github.com/openai/codex)** — OpenAI 的终端编码智能体

您应该熟悉版本控制、项目结构和敏捷工作流等基本软件开发概念。无需具备 BMad 风格智能体系统的先验经验——这正是本文档的作用。

## 加入社区

获取帮助、分享您的构建内容，或为 BMad 做出贡献：

- **[Discord](https://discord.gg/gk8jAdXWmj)** — 与其他 BMad 用户聊天、提问、分享想法
- **[GitHub](https://github.com/bmad-code-org/BMAD-METHOD)** — 源代码、问题和贡献
- **[YouTube](https://www.youtube.com/@BMadCode)** — 视频教程和演练

## 下一步

准备开始了吗？**[BMad 入门指南](./tutorials/getting-started.md)** 并构建您的第一个项目。

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **AI-driven**：AI 驱动。指由人工智能技术主导或驱动的系统或方法。
- **workflow**：工作流。指一系列有序的任务或步骤，用于完成特定目标。
- **prompt**：提示词。指输入给 AI 模型的指令或问题，用于引导其生成特定输出。
- **context**：上下文。指在特定场景下理解信息所需的背景信息或环境。
</document>

<document path="zh-cn/reference/agents.md">
## 默认智能体

本页列出了随 BMad Method 安装的默认 BMM（Agile 套件）智能体，以及它们的菜单触发器和主要工作流。

## 注意事项

- 触发器是显示在每个智能体菜单中的简短菜单代码（例如 `CP`）和模糊匹配。
- 斜杠命令是单独生成的。斜杠命令列表及其定义位置请参阅[命令](./commands.md)。
- QA（Quinn）是 BMM 中的轻量级测试自动化智能体。完整的测试架构师（TEA）位于其独立模块中。

| 智能体                      | 触发                            | 主要工作流                                                                                           |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Analyst (Mary)              | `BP`, `RS`, `CB`, `DP`            | 头脑风暴项目、研究、创建简报、文档化项目                                                              |
| Product Manager (John)      | `CP`, `VP`, `EP`, `CE`, `IR`, `CC` | 创建/验证/编辑 PRD、创建史诗和用户故事、实施就绪、纠正方向                                            |
| Architect (Winston)         | `CA`, `IR`                        | 创建架构、实施就绪                                                                                   |
| Scrum Master (Bob)          | `SP`, `CS`, `ER`, `CC`            | 冲刺规划、创建用户故事、史诗回顾、纠正方向                                                           |
| Developer (Amelia)          | `DS`, `CR`                        | 开发用户故事、代码评审                                                                               |
| QA Engineer (Quinn)         | `QA`                              | 自动化（为现有功能生成测试）                                                                         |
| Quick Flow Solo Dev (Barry) | `QS`, `QD`, `CR`                  | 快速规格、快速开发、代码评审                                                                         |
| UX Designer (Sally)         | `CU`                              | 创建 UX 设计                                                                                         |
| Technical Writer (Paige)    | `DP`, `WD`, `US`, `MG`, `VD`, `EC` | 文档化项目、撰写文档、更新标准、Mermaid 生成、验证文档、解释概念                                      |

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **BMM**：BMad Method 中的默认智能体套件，涵盖敏捷开发流程中的各类角色。
- **PRD**：产品需求文档（Product Requirements Document）。
- **Epic**：史诗。大型功能或需求集合，可拆分为多个用户故事。
- **Story**：用户故事。描述用户需求的简短陈述。
- **Sprint**：冲刺。敏捷开发中的固定时间周期迭代。
- **QA**：质量保证（Quality Assurance）。
- **TEA**：测试架构师（Test Architect）。
- **Mermaid**：一种用于生成图表和流程图的文本语法。
</document>

<document path="zh-cn/reference/commands.md">
斜杠命令是预构建的提示词，用于在 IDE 中加载智能体、运行工作流或执行任务。BMad 安装程序在安装时根据已安装的模块生成这些命令。如果您后续添加、删除或更改模块，请重新运行安装程序以保持命令同步（参见[故障排除](#troubleshooting)）。

## 命令与智能体菜单触发器

BMad 提供两种开始工作的方式，它们服务于不同的目的。

| 机制 | 调用方式 | 发生什么 |
| --- | --- | --- |
| **斜杠命令** | 在 IDE 中输入 `/bmad-...` | 直接加载智能体、运行工作流或执行任务 |
| **智能体菜单触发器** | 先加载智能体，然后输入简短代码（例如 `DS`） | 智能体解释代码并启动匹配的工作流，同时保持角色设定 |

智能体菜单触发器需要活动的智能体会话。当您知道要使用哪个工作流时，使用斜杠命令。当您已经与智能体一起工作并希望在不离开对话的情况下切换任务时，使用触发器。

## 命令如何生成

当您运行 `npx bmad-method install` 时，安装程序会读取每个选定模块的清单，并为每个智能体、工作流、任务和工具编写一个命令文件。每个文件都是一个简短的 Markdown 提示词，指示 AI 加载相应的源文件并遵循其指令。

安装程序为每种命令类型使用模板：

| 命令类型 | 生成的文件的作用 |
| --- | --- |
| **智能体启动器** | 加载智能体角色文件，激活其菜单，并保持角色设定 |
| **工作流命令** | 加载工作流引擎（`workflow.xml`）并传递工作流配置 |
| **任务命令** | 加载独立任务文件并遵循其指令 |
| **工具命令** | 加载独立工具文件并遵循其指令 |

:::note[重新运行安装程序]
如果您添加或删除模块，请再次运行安装程序。它会重新生成所有命令文件以匹配您当前的模块选择。
:::

## 命令文件的位置

安装程序将命令文件写入项目内 IDE 特定的目录中。确切路径取决于您在安装期间选择的 IDE。

| IDE / CLI | 命令目录 |
| --- | --- |
| Claude Code | `.claude/commands/` |
| Cursor | `.cursor/commands/` |
| Windsurf | `.windsurf/workflows/` |
| 其他 IDE | 请参阅安装程序输出中的目标路径 |

所有 IDE 都在其命令目录中接收一组扁平的命令文件。例如，Claude Code 安装看起来像：

```text
.claude/commands/
├── bmad-agent-bmm-dev.md
├── bmad-agent-bmm-pm.md
├── bmad-bmm-create-prd.md
├── bmad-editorial-review-prose.md
├── bmad-help.md
└── ...
```

文件名决定了 IDE 中的斜杠命令名称。例如，文件 `bmad-agent-bmm-dev.md` 注册命令 `/bmad-agent-bmm-dev`。

## 如何发现您的命令

在 IDE 中输入 `/bmad` 并使用自动完成功能浏览可用命令。

运行 `/bmad-help` 获取关于下一步的上下文感知指导。

:::tip[快速发现]
项目中生成的命令文件夹是权威列表。在文件资源管理器中打开它们以查看每个命令及其描述。
:::

## 命令类别

### 智能体命令

智能体命令加载具有定义角色、沟通风格和工作流菜单的专业化 AI 角色。加载后，智能体保持角色设定并响应菜单触发器。

| 示例命令 | 智能体 | 角色 |
| --- | --- | --- |
| `/bmad-agent-bmm-dev` | Amelia（开发者） | 严格按照规范实现故事 |
| `/bmad-agent-bmm-pm` | John（产品经理） | 创建和验证 PRD |
| `/bmad-agent-bmm-architect` | Winston（架构师） | 设计系统架构 |
| `/bmad-agent-bmm-sm` | Bob（Scrum Master） | 管理冲刺和故事 |

参见[智能体](./agents.md)获取默认智能体及其触发器的完整列表。

### 工作流命令

工作流命令运行结构化的多步骤过程，而无需先加载智能体角色。它们加载工作流引擎并传递特定的工作流配置。

| 示例命令 | 目的 |
| --- | --- |
| `/bmad-bmm-create-prd` | 创建产品需求文档 |
| `/bmad-bmm-create-architecture` | 设计系统架构 |
| `/bmad-bmm-dev-story` | 实现故事 |
| `/bmad-bmm-code-review` | 运行代码审查 |
| `/bmad-bmm-quick-spec` | 定义临时更改（快速流程） |

参见[工作流地图](./workflow-map.md)获取按阶段组织的完整工作流参考。

### 任务和工具命令

任务和工具是独立的操作，不需要智能体或工作流上下文。

#### BMad-Help：您的智能向导

**`/bmad-help`** 是您发现下一步操作的主要界面。它不仅仅是一个查找工具——它是一个智能助手，可以：

- **检查您的项目**以查看已经完成的工作
- **理解自然语言查询**——用简单的英语提问
- **根据已安装的模块而变化**——根据您拥有的内容显示选项
- **在工作流后自动调用**——每个工作流都以清晰的下一步结束
- **推荐第一个必需任务**——无需猜测从哪里开始

**示例：**

```
/bmad-help
/bmad-help 我有一个 SaaS 想法并且知道所有功能。我应该从哪里开始？
/bmad-help 我在 UX 设计方面有哪些选择？
/bmad-help 我在 PRD 工作流上卡住了
```

#### 其他任务和工具

| 示例命令 | 目的 |
| --- | --- |
| `/bmad-shard-doc` | 将大型 Markdown 文件拆分为较小的部分 |
| `/bmad-index-docs` | 索引项目文档 |
| `/bmad-editorial-review-prose` | 审查文档散文质量 |

## 命名约定

命令名称遵循可预测的模式。

| 模式 | 含义 | 示例 |
| --- | --- | --- |
| `bmad-agent-<module>-<name>` | 智能体启动器 | `bmad-agent-bmm-dev` |
| `bmad-<module>-<workflow>` | 工作流命令 | `bmad-bmm-create-prd` |
| `bmad-<name>` | 核心任务或工具 | `bmad-help` |

模块代码：`bmm`（敏捷套件）、`bmb`（构建器）、`tea`（测试架构师）、`cis`（创意智能）、`gds`（游戏开发工作室）。参见[模块](./modules.md)获取描述。

## 故障排除

**安装后命令未出现。** 重启您的 IDE 或重新加载窗口。某些 IDE 会缓存命令列表，需要刷新才能获取新文件。

**预期的命令缺失。** 安装程序仅为您选择的模块生成命令。再次运行 `npx bmad-method install` 并验证您的模块选择。检查命令文件是否存在于预期目录中。

**已删除模块的命令仍然出现。** 安装程序不会自动删除旧的命令文件。从 IDE 的命令目录中删除过时的文件，或删除整个命令目录并重新运行安装程序以获取一组干净的命令。

---
## 术语说明

- **slash command**：斜杠命令。以 `/` 开头的命令，用于在 IDE 中快速执行特定操作。
- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **workflow**：工作流。一系列结构化的步骤，用于完成特定任务或流程。
- **IDE**：集成开发环境。用于软件开发的综合应用程序，提供代码编辑、调试、构建等功能。
- **persona**：角色设定。为智能体定义的特定角色、性格和行为方式。
- **trigger**：触发器。用于启动特定操作或流程的机制。
- **manifest**：清单。描述模块或组件的元数据文件。
- **installer**：安装程序。用于安装和配置软件的工具。
- **PRD**：产品需求文档。描述产品功能、需求和规范的文档。
- **SaaS**：软件即服务。通过互联网提供软件服务的模式。
- **UX**：用户体验。用户在使用产品或服务过程中的整体感受和交互体验。
</document>

<document path="zh-cn/reference/modules.md">
BMad 通过您在安装期间选择的官方模块进行扩展。这些附加模块为内置核心和 BMM（敏捷套件）之外的特定领域提供专门的智能体、工作流和任务。

:::tip[安装模块]
运行 `npx bmad-method install` 并选择您需要的模块。安装程序会自动处理下载、配置和 IDE 集成。
:::

## BMad Builder

在引导式协助下创建自定义智能体、工作流和特定领域的模块。BMad Builder 是用于扩展框架本身的元模块。

- **代码：** `bmb`
- **npm：** [`bmad-builder`](https://www.npmjs.com/package/bmad-builder)
- **GitHub：** [bmad-code-org/bmad-builder](https://github.com/bmad-code-org/bmad-builder)

**提供：**

- 智能体构建器 —— 创建具有自定义专业知识和工具访问权限的专用 AI 智能体
- 工作流构建器 —— 设计包含步骤和决策点的结构化流程
- 模块构建器 —— 将智能体和工作流打包为可共享、可发布的模块
- 交互式设置，支持 YAML 配置和 npm 发布

## 创意智能套件

用于早期开发阶段的结构化创意、构思和创新的 AI 驱动工具。该套件提供多个智能体，利用经过验证的框架促进头脑风暴、设计思维和问题解决。

- **代码：** `cis`
- **npm：** [`bmad-creative-intelligence-suite`](https://www.npmjs.com/package/bmad-creative-intelligence-suite)
- **GitHub：** [bmad-code-org/bmad-module-creative-intelligence-suite](https://github.com/bmad-code-org/bmad-module-creative-intelligence-suite)

**提供：**

- 创新策略师、设计思维教练和头脑风暴教练智能体
- 问题解决者和创意问题解决者，用于系统性和横向思维
- 故事讲述者和演示大师，用于叙事和推介
- 构思框架，包括 SCAMPER、逆向头脑风暴和问题重构

## 游戏开发工作室

适用于 Unity、Unreal、Godot 和自定义引擎的结构化游戏开发工作流。通过 Quick Flow 支持快速原型制作，并通过史诗驱动的冲刺支持全面规模的生产。

- **代码：** `gds`
- **npm：** [`bmad-game-dev-studio`](https://www.npmjs.com/package/bmad-game-dev-studio)
- **GitHub：** [bmad-code-org/bmad-module-game-dev-studio](https://github.com/bmad-code-org/bmad-module-game-dev-studio)

**提供：**

- 游戏设计文档（GDD）生成工作流
- 用于快速原型制作的 Quick Dev 模式
- 针对角色、对话和世界构建的叙事设计支持
- 覆盖 21+ 种游戏类型，并提供特定引擎的架构指导

## 测试架构师（TEA）

通过专家智能体和九个结构化工作流提供企业级测试策略、自动化指导和发布门控决策。TEA 远超内置 QA 智能体，提供基于风险的优先级排序和需求可追溯性。

- **代码：** `tea`
- **npm：** [`bmad-method-test-architecture-enterprise`](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise)
- **GitHub：** [bmad-code-org/bmad-method-test-architecture-enterprise](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise)

**提供：**

- Murat 智能体（主测试架构师和质量顾问）
- 用于测试设计、ATDD、自动化、测试审查和可追溯性的工作流
- NFR 评估、CI 设置和框架脚手架
- P0-P3 优先级排序，可选 Playwright Utils 和 MCP 集成

## 社区模块

社区模块和模块市场即将推出。请查看 [BMad GitHub 组织](https://github.com/bmad-code-org) 获取最新更新。

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **workflow**：工作流。指一系列有序的任务或步骤，用于完成特定的业务流程或开发流程。
- **module**：模块。指可独立开发、测试和部署的软件单元，用于扩展系统功能。
- **meta-module**：元模块。指用于创建或扩展其他模块的模块，是模块的模块。
- **ATDD**：验收测试驱动开发（Acceptance Test-Driven Development）。一种敏捷开发实践，在编写代码之前先编写验收测试。
- **NFR**：非功能性需求（Non-Functional Requirement）。指系统在性能、安全性、可维护性等方面的质量属性要求。
- **CI**：持续集成（Continuous Integration）。一种软件开发实践，频繁地将代码集成到主干分支，并进行自动化测试。
- **MCP**：模型上下文协议（Model Context Protocol）。一种用于在 AI 模型与外部工具或服务之间进行通信的协议。
- **SCAMPER**：一种创意思维技巧，包含替代、组合、调整、修改、其他用途、消除和重组七个维度。
- **GDD**：游戏设计文档（Game Design Document）。用于描述游戏设计理念、玩法、机制等内容的详细文档。
- **P0-P3**：优先级分级。P0 为最高优先级（关键），P3 为最低优先级（可选）。
- **sprint**：冲刺。敏捷开发中的固定时间周期，通常为 1-4 周，用于完成预定的工作。
- **epic**：史诗。敏捷开发中的大型工作项，可分解为多个用户故事或任务。
- **Quick Flow**：快速流程。一种用于快速原型开发的工作流模式。
</document>

<document path="zh-cn/reference/testing.md">
BMad 提供两条测试路径：用于快速生成测试的内置 QA 智能体，以及用于企业级测试策略的可安装测试架构师模块。

## 应该使用哪一个？

| 因素 | Quinn（内置 QA） | TEA 模块 |
| --- | --- | --- |
| **最适合** | 中小型项目、快速覆盖 | 大型项目、受监管或复杂领域 |
| **设置** | 无需安装——包含在 BMM 中 | 通过 `npx bmad-method install` 单独安装 |
| **方法** | 快速生成测试，稍后迭代 | 先规划，再生成并保持可追溯性 |
| **测试类型** | API 和 E2E 测试 | API、E2E、ATDD、NFR 等 |
| **策略** | 快乐路径 + 关键边界情况 | 基于风险的优先级排序（P0-P3） |
| **工作流数量** | 1（Automate） | 9（设计、ATDD、自动化、审查、可追溯性等） |

:::tip[从 Quinn 开始]
大多数项目应从 Quinn 开始。如果后续需要测试策略、质量门控或需求可追溯性，可并行安装 TEA。
:::

## 内置 QA 智能体（Quinn）

Quinn 是 BMM（敏捷套件）模块中的内置 QA 智能体。它使用项目现有的测试框架快速生成可运行的测试——无需配置或额外安装。

**触发方式：** `QA` 或 `bmad-bmm-qa-automate`

### Quinn 的功能

Quinn 运行单个工作流（Automate），包含五个步骤：

1. **检测测试框架**——扫描 `package.json` 和现有测试文件以识别框架（Jest、Vitest、Playwright、Cypress 或任何标准运行器）。如果不存在，则分析项目技术栈并推荐一个。
2. **识别功能**——询问要测试的内容或自动发现代码库中的功能。
3. **生成 API 测试**——覆盖状态码、响应结构、快乐路径和 1-2 个错误情况。
4. **生成 E2E 测试**——使用语义定位器和可见结果断言覆盖用户工作流。
5. **运行并验证**——执行生成的测试并立即修复失败。

Quinn 会生成测试摘要，保存到项目的实现产物文件夹中。

### 测试模式

生成的测试遵循"简单且可维护"的理念：

- **仅使用标准框架 API**——不使用外部工具或自定义抽象
- UI 测试使用**语义定位器**（角色、标签、文本而非 CSS 选择器）
- **独立测试**，无顺序依赖
- **无硬编码等待或休眠**
- **清晰的描述**，可作为功能文档阅读

:::note[范围]
Quinn 仅生成测试。如需代码审查和故事验证，请改用代码审查工作流（`CR`）。
:::

### 何时使用 Quinn

- 为新功能或现有功能快速实现测试覆盖
- 无需高级设置的初学者友好型测试自动化
- 任何开发者都能阅读和维护的标准测试模式
- 不需要全面测试策略的中小型项目

## 测试架构师（TEA）模块

TEA 是一个独立模块，提供专家智能体（Murat）和九个结构化工作流，用于企业级测试。它超越了测试生成，涵盖测试策略、基于风险的规划、质量门控和需求可追溯性。

- **文档：** [TEA 模块文档](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/)
- **安装：** `npx bmad-method install` 并选择 TEA 模块
- **npm：** [`bmad-method-test-architecture-enterprise`](https://www.npmjs.com/package/bmad-method-test-architecture-enterprise)

### TEA 提供的功能

| Workflow | Purpose |
| --- | --- |
| Test Design | 创建与需求关联的全面测试策略 |
| ATDD | 基于干系人标准的验收测试驱动开发 |
| Automate | 使用高级模式和工具生成测试 |
| Test Review | 根据策略验证测试质量和覆盖范围 |
| Traceability | 将测试映射回需求，用于审计和合规 |
| NFR Assessment | 评估非功能性需求（性能、安全性） |
| CI Setup | 在持续集成管道中配置测试执行 |
| Framework Scaffolding | 设置测试基础设施和项目结构 |
| Release Gate | 基于数据做出发布/不发布决策 |

TEA 还支持 P0-P3 基于风险的优先级排序，以及与 Playwright Utils 和 MCP 工具的可选集成。

### 何时使用 TEA

- 需要需求可追溯性或合规文档的项目
- 需要在多个功能间进行基于风险的测试优先级排序的团队
- 发布前具有正式质量门控的企业环境
- 在编写测试前必须规划测试策略的复杂领域
- 已超出 Quinn 单一工作流方法的项目

## 测试如何融入工作流

Quinn 的 Automate 工作流出现在 BMad 方法工作流图的第 4 阶段（实现）。典型序列：

1. 使用开发工作流（`DS`）实现一个故事
2. 使用 Quinn（`QA`）或 TEA 的 Automate 工作流生成测试
3. 使用代码审查（`CR`）验证实现

Quinn 直接从源代码工作，无需加载规划文档（PRD、架构）。TEA 工作流可以与上游规划产物集成以实现可追溯性。

有关测试在整体流程中的位置，请参阅[工作流图](./workflow-map.md)。

---
## 术语说明

- **QA (Quality Assurance)**：质量保证。确保产品或服务满足质量要求的过程。
- **E2E (End-to-End)**：端到端。测试整个系统从开始到结束的完整流程。
- **ATDD (Acceptance Test-Driven Development)**：验收测试驱动开发。在编码前先编写验收测试的开发方法。
- **NFR (Non-Functional Requirement)**：非功能性需求。描述系统如何运行而非做什么的需求，如性能、安全性等。
- **P0-P3**：优先级级别。P0 为最高优先级，P3 为最低优先级，用于基于风险的测试排序。
- **Happy path**：快乐路径。测试系统在理想条件下的正常工作流程。
- **Semantic locators**：语义定位器。使用有意义的元素属性（如角色、标签、文本）而非 CSS 选择器来定位 UI 元素。
- **Quality gates**：质量门控。在开发流程中设置的检查点，用于确保质量标准。
- **Requirements traceability**：需求可追溯性。能够追踪需求从设计到测试再到实现的完整链路。
- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **CI (Continuous Integration)**：持续集成。频繁地将代码集成到主干，并自动运行测试的实践。
- **MCP (Model Context Protocol)**：模型上下文协议。用于在 AI 模型与外部工具之间通信的协议。
</document>

<document path="zh-cn/reference/workflow-map.md">
BMad Method（BMM）是 BMad 生态系统中的一个模块，旨在遵循上下文工程与规划的最佳实践。AI 智能体在清晰、结构化的上下文中表现最佳。BMM 系统在 4 个不同阶段中逐步构建该上下文——每个阶段以及每个阶段内的多个可选工作流程都会生成文档，这些文档为下一阶段提供信息，因此智能体始终知道要构建什么以及为什么。

其基本原理和概念来自敏捷方法论，这些方法论在整个行业中被广泛用作思维框架，并取得了巨大成功。

如果您在任何时候不确定该做什么，`/bmad-help` 命令将帮助您保持正轨或了解下一步该做什么。您也可以随时参考此文档以获取参考信息——但如果您已经安装了 BMad Method，`/bmad-help` 是完全交互式的，速度要快得多。此外，如果您正在使用扩展了 BMad Method 或添加了其他互补非扩展模块的不同模块——`/bmad-help` 会不断演进以了解所有可用内容，从而为您提供最佳即时建议。

最后的重要说明：以下每个工作流程都可以通过斜杠命令直接使用您选择的工具运行，或者先加载智能体，然后使用智能体菜单中的条目来运行。

<iframe src="/workflow-map-diagram.html" title="BMad Method Workflow Map Diagram" width="100%" height="100%" style="border-radius: 8px; border: 1px solid #334155; min-height: 900px;"></iframe>

<p style="font-size: 0.8rem; text-align: right; margin-top: -0.5rem; margin-bottom: 1rem;">
  <a href="/workflow-map-diagram.html" target="_blank" rel="noopener noreferrer">在新标签页中打开图表 ↗</a>
</p>

## 阶段 1：分析（可选）

在投入规划之前探索问题空间并验证想法。

| 工作流程                        | 目的                                                                    | 产出                  |
| ------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| `bmad-brainstorming`            | 在头脑风暴教练的引导协助下进行项目想法头脑风暴 | `brainstorming-report.md` |
| `bmad-bmm-research`             | 验证市场、技术或领域假设                          | 研究发现         |
| `bmad-bmm-create-product-brief` | 捕捉战略愿景                                                   | `product-brief.md`        |

## 阶段 2：规划

定义要构建什么以及为谁构建。

| 工作流程                    | 目的                                  | 产出     |
| --------------------------- | ---------------------------------------- | ------------ |
| `bmad-bmm-create-prd`       | 定义需求（FRs/NFRs）           | `PRD.md`     |
| `bmad-bmm-create-ux-design` | 设计用户体验（当 UX 重要时） | `ux-spec.md` |

## 阶段 3：解决方案设计

决定如何构建它并将工作分解为故事。

| 工作流程                                  | 目的                                    | 产出                    |
| ----------------------------------------- | ------------------------------------------ | --------------------------- |
| `bmad-bmm-create-architecture`            | 明确技术决策          | 包含 ADR 的 `architecture.md` |
| `bmad-bmm-create-epics-and-stories`       | 将需求分解为可实施的工作 | 包含故事的 Epic 文件     |
| `bmad-bmm-check-implementation-readiness` | 实施前的关卡检查           | PASS/CONCERNS/FAIL 决策 |

## 阶段 4：实施

逐个故事地构建它。即将推出完整的阶段 4 自动化！

| 工作流程                   | 目的                                                                  | 产出                         |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| `bmad-bmm-sprint-planning` | 初始化跟踪（每个项目一次，以排序开发周期）         | `sprint-status.yaml`             |
| `bmad-bmm-create-story`    | 准备下一个故事以供实施                                    | `story-[slug].md`                |
| `bmad-bmm-dev-story`       | 实施该故事                                                      | 工作代码 + 测试             |
| `bmad-bmm-code-review`     | 验证实施质量                                          | 批准或请求更改    |
| `bmad-bmm-correct-course`  | 处理冲刺中的重大变更                                    | 更新的计划或重新路由       |
| `bmad-bmm-automate`        | 为现有功能生成测试 - 在完整的 epic 完成后使用 | 端到端 UI 专注测试套件 |
| `bmad-bmm-retrospective`   | 在 epic 完成后回顾                                             | 经验教训                  |

## 快速流程（并行轨道）

对于小型、易于理解的工作，跳过阶段 1-3。

| 工作流程              | 目的                                    | 产出                                      |
| --------------------- | ------------------------------------------ | --------------------------------------------- |
| `bmad-bmm-quick-spec` | 定义临时变更                    | `tech-spec.md`（小型变更的故事文件） |
| `bmad-bmm-quick-dev`  | 根据规范或直接指令实施 | 工作代码 + 测试                          |

## 上下文管理

每个文档都成为下一阶段的上下文。PRD 告诉架构师哪些约束很重要。架构告诉开发智能体要遵循哪些模式。故事文件为实施提供专注、完整的上下文。没有这种结构，智能体会做出不一致的决策。

### 项目上下文

:::tip[推荐]
创建 `project-context.md` 以确保 AI 智能体遵循您项目的规则和偏好。该文件就像您项目的宪法——它指导所有工作流程中的实施决策。这个可选文件可以在架构创建结束时生成，或者在现有项目中也可以生成它，以捕捉与当前约定保持一致的重要内容。
:::

**如何创建它：**

- **手动** — 使用您的技术栈和实施规则创建 `_bmad-output/project-context.md`
- **生成它** — 运行 `/bmad-bmm-generate-project-context` 以从您的架构或代码库自动生成

[**了解更多关于 project-context.md**](../explanation/project-context.md)

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **BMad Method (BMM)**：BMad 方法。BMad 生态系统中的一个模块，用于上下文工程与规划。
- **FRs/NFRs**：功能需求/非功能需求。Functional Requirements/Non-Functional Requirements 的缩写。
- **PRD**：产品需求文档。Product Requirements Document 的缩写。
- **UX**：用户体验。User Experience 的缩写。
- **ADR**：架构决策记录。Architecture Decision Record 的缩写。
- **Epic**：史诗。大型功能或用户故事的集合，通常需要多个冲刺才能完成。
- **Story**：用户故事。描述用户需求的简短陈述。
- **Sprint**：冲刺。敏捷开发中的固定时间周期，用于完成预定的工作。
- **Slug**：短标识符。URL 友好的标识符，通常用于文件命名。
- **Context**：上下文。为 AI 智能体提供的环境信息和背景资料。
</document>

<document path="zh-cn/tutorials/getting-started.md">
使用 AI 驱动的工作流更快地构建软件，通过专门的智能体引导你完成规划、架构设计和实现。

## 你将学到

- 为新项目安装并初始化 BMad Method
- 使用 **BMad-Help** —— 你的智能向导，它知道下一步该做什么
- 根据项目规模选择合适的规划路径
- 从需求到可用代码，逐步推进各个阶段
- 有效使用智能体和工作流

:::note[前置条件]
- **Node.js 20+** — 安装程序必需
- **Git** — 推荐用于版本控制
- **AI 驱动的 IDE** — Claude Code、Cursor 或类似工具
- **一个项目想法** — 即使是简单的想法也可以用于学习
:::

:::tip[最简单的路径]
**安装** → `npx bmad-method install`
**询问** → `/bmad-help 我应该先做什么？`
**构建** → 让 BMad-Help 逐个工作流地引导你
:::

## 认识 BMad-Help：你的智能向导

**BMad-Help 是开始使用 BMad 的最快方式。** 你不需要记住工作流或阶段 —— 只需询问，BMad-Help 就会：

- **检查你的项目**，看看已经完成了什么
- **根据你安装的模块显示你的选项**
- **推荐下一步** —— 包括第一个必需任务
- **回答问题**，比如"我有一个 SaaS 想法，应该从哪里开始？"

### 如何使用 BMad-Help

只需在 AI IDE 中使用斜杠命令运行它：

```
/bmad-help
```

或者结合问题以获得上下文感知的指导：

```
/bmad-help 我有一个 SaaS 产品的想法，我已经知道我想要的所有功能。我应该从哪里开始？
```

BMad-Help 将回应：
- 针对你的情况推荐什么
- 第一个必需任务是什么
- 其余流程是什么样的

### 它也驱动工作流

BMad-Help 不仅回答问题 —— **它会在每个工作流结束时自动运行**，告诉你确切地下一步该做什么。无需猜测，无需搜索文档 —— 只需对下一个必需工作流的清晰指导。

:::tip[从这里开始]
安装 BMad 后，立即运行 `/bmad-help`。它将检测你安装了哪些模块，并引导你找到项目的正确起点。
:::

## 了解 BMad

BMad 通过带有专门 AI 智能体的引导工作流帮助你构建软件。该过程遵循四个阶段：

| 阶段 | 名称           | 发生什么                                           |
| ---- | -------------- | -------------------------------------------------- |
| 1    | 分析           | 头脑风暴、研究、产品简报 *（可选）*                |
| 2    | 规划           | 创建需求（PRD 或技术规范）                         |
| 3    | 解决方案设计   | 设计架构 *（仅限 BMad Method/Enterprise only）*         |
| 4    | 实现           | 逐个史诗、逐个故事地构建                           |

**[打开工作流地图](../reference/workflow-map.md)** 以探索阶段、工作流和上下文管理。

根据项目的复杂性，BMad 提供三种规划路径：

| 路径           | 最适合                                               | 创建的文档                              |
| --------------- | ---------------------------------------------------- | --------------------------------------- |
| **Quick Flow**  | 错误修复、简单功能、范围清晰（1-15 个故事）          | 仅技术规范                              |
| **BMad Method** | 产品、平台、复杂功能（10-50+ 个故事）                | PRD + 架构 + UX                         |
| **Enterprise**  | 合规、多租户系统（30+ 个故事）                       | PRD + 架构 + 安全 + DevOps              |

:::note
故事数量是指导，而非定义。根据规划需求选择你的路径，而不是故事数学。
:::

## 安装

在项目目录中打开终端并运行：

```bash
npx bmad-method install
```

当提示选择模块时，选择 **BMad Method**。

安装程序会创建两个文件夹：
- `_bmad/` — 智能体、工作流、任务和配置
- `_bmad-output/` — 目前为空，但这是你的工件将被保存的地方

:::tip[你的下一步]
在项目文件夹中打开你的 AI IDE 并运行：

```
/bmad-help
```

BMad-Help 将检测你已完成的内容，并准确推荐下一步该做什么。你也可以问它诸如"我的选项是什么？"或"我有一个 SaaS 想法，我应该从哪里开始？"之类的问题。
:::

:::note[如何加载智能体和运行工作流]
每个工作流都有一个你在 IDE 中运行的**斜杠命令**（例如 `/bmad-bmm-create-prd`）。运行工作流命令会自动加载相应的智能体 —— 你不需要单独加载智能体。你也可以直接加载智能体进行一般对话（例如，加载 PM 智能体使用 `/bmad-agent-bmm-pm`）。
:::

:::caution[新对话]
始终为每个工作流开始一个新的对话。这可以防止上下文限制导致问题。
:::

## 步骤 1：创建你的计划

完成阶段 1-3。**为每个工作流使用新对话。**

:::tip[项目上下文（可选）]
在开始之前，考虑创建 `project-context.md` 来记录你的技术偏好和实现规则。这确保所有 AI 智能体在整个项目中遵循你的约定。

在 `_bmad-output/project-context.md` 手动创建它，或在架构之后使用 `/bmad-bmm-generate-project-context` 生成它。[了解更多](../explanation/project-context.md)。
:::

### 阶段 1：分析（可选）

此阶段中的所有工作流都是可选的：
- **头脑风暴**（`/bmad-brainstorming`） — 引导式构思
- **研究**（`/bmad-bmm-research`） — 市场和技术研究
- **创建产品简报**（`/bmad-bmm-create-product-brief`） — 推荐的基础文档

### 阶段 2：规划（必需）

**对于 BMad Method 和 Enterprise 路径：**
1. 在新对话中加载 **PM 智能体**（`/bmad-agent-bmm-pm`）
2. 运行 `prd` 工作流（`/bmad-bmm-create-prd`）
3. 输出：`PRD.md`

**对于 Quick Flow 路径：**
- 使用 `quick-spec` 工作流（`/bmad-bmm-quick-spec`）代替 PRD，然后跳转到实现

:::note[UX 设计（可选）]
如果你的项目有用户界面，在创建 PRD 后加载 **UX-Designer 智能体**（`/bmad-agent-bmm-ux-designer`）并运行 UX 设计工作流（`/bmad-bmm-create-ux-design`）。
:::

### 阶段 3：解决方案设计（BMad Method/Enterprise）

**创建架构**
1. 在新对话中加载 **Architect 智能体**（`/bmad-agent-bmm-architect`）
2. 运行 `create-architecture`（`/bmad-bmm-create-architecture`）
3. 输出：包含技术决策的架构文档

**创建史诗和故事**

:::tip[V6 改进]
史诗和故事现在在架构*之后*创建。这会产生更高质量的故事，因为架构决策（数据库、API 模式、技术栈）直接影响工作应该如何分解。
:::

1. 在新对话中加载 **PM 智能体**（`/bmad-agent-bmm-pm`）
2. 运行 `create-epics-and-stories`（`/bmad-bmm-create-epics-and-stories`）
3. 工作流使用 PRD 和架构来创建技术信息丰富的故事

**实现就绪检查** *（强烈推荐）*
1. 在新对话中加载 **Architect 智能体**（`/bmad-agent-bmm-architect`）
2. 运行 `check-implementation-readiness`（`/bmad-bmm-check-implementation-readiness`）
3. 验证所有规划文档之间的一致性

## 步骤 2：构建你的项目

规划完成后，进入实现阶段。**每个工作流应该在新对话中运行。**

### 初始化冲刺规划

加载 **SM 智能体**（`/bmad-agent-bmm-sm`）并运行 `sprint-planning`（`/bmad-bmm-sprint-planning`）。这将创建 `sprint-status.yaml` 来跟踪所有史诗和故事。

### 构建周期

对于每个故事，使用新对话重复此周期：

| 步骤 | 智能体 | 工作流       | 命令                    | 目的                            |
| ---- | ------ | ------------ | ----------------------- | ------------------------------- |
| 1    | SM     | `create-story` | `/bmad-bmm-create-story`  | 从史诗创建故事文件              |
| 2    | DEV    | `dev-story`    | `/bmad-bmm-dev-story`     | 实现故事                        |
| 3    | DEV    | `code-review`  | `/bmad-bmm-code-review`   | 质量验证 *（推荐）*             |

完成史诗中的所有故事后，加载 **SM 智能体**（`/bmad-agent-bmm-sm`）并运行 `retrospective`（`/bmad-bmm-retrospective`）。

## 你已完成的工作

你已经学习了使用 BMad 构建的基础：

- 安装了 BMad 并为你的 IDE 进行了配置
- 使用你选择的规划路径初始化了项目
- 创建了规划文档（PRD、架构、史诗和故事）
- 了解了实现的构建周期

你的项目现在拥有：

```text
your-project/
├── _bmad/                                   # BMad 配置
├── _bmad-output/
│   ├── planning-artifacts/
│   │   ├── PRD.md                           # 你的需求文档
│   │   ├── architecture.md                  # 技术决策
│   │   └── epics/                           # 史诗和故事文件
│   ├── implementation-artifacts/
│   │   └── sprint-status.yaml               # 冲刺跟踪
│   └── project-context.md                   # 实现规则（可选）
└── ...
```

## 快速参考

| 工作流                              | 命令                                    | 智能体   | 目的                                         |
| ----------------------------------- | --------------------------------------- | -------- | -------------------------------------------- |
| **`help`** ⭐                       | `/bmad-help`                            | 任意     | **你的智能向导 —— 随时询问任何问题！**        |
| `prd`                               | `/bmad-bmm-create-prd`                  | PM       | 创建产品需求文档                             |
| `create-architecture`               | `/bmad-bmm-create-architecture`         | Architect | 创建架构文档                                 |
| `generate-project-context`          | `/bmad-bmm-generate-project-context`    | Analyst  | 创建项目上下文文件                           |
| `create-epics-and-stories`          | `/bmad-bmm-create-epics-and-stories`    | PM       | 将 PRD 分解为史诗                            |
| `check-implementation-readiness`    | `/bmad-bmm-check-implementation-readiness` | Architect | 验证规划一致性                               |
| `sprint-planning`                   | `/bmad-bmm-sprint-planning`             | SM       | 初始化冲刺跟踪                               |
| `create-story`                      | `/bmad-bmm-create-story`                | SM       | 创建故事文件                                 |
| `dev-story`                         | `/bmad-bmm-dev-story`                   | DEV      | 实现故事                                     |
| `code-review`                       | `/bmad-bmm-code-review`                 | DEV      | 审查已实现的代码                             |

## 常见问题

**我总是需要架构吗？**
仅对于 BMad Method 和 Enterprise 路径。Quick Flow 从技术规范跳转到实现。

**我可以稍后更改我的计划吗？**
可以。SM 智能体有一个 `correct-course` 工作流（`/bmad-bmm-correct-course`）用于处理范围变更。

**如果我想先进行头脑风暴怎么办？**
在开始 PRD 之前，加载 Analyst 智能体（`/bmad-agent-bmm-analyst`）并运行 `brainstorming`（`/bmad-brainstorming`）。

**我需要遵循严格的顺序吗？**
不一定。一旦你了解了流程，你可以使用上面的快速参考直接运行工作流。

## 获取帮助

:::tip[第一站：BMad-Help]
**随时运行 `/bmad-help`** —— 这是摆脱困境的最快方式。问它任何问题：
- "安装后我应该做什么？"
- "我在工作流 X 上卡住了"
- "我在 Y 方面有什么选项？"
- "向我展示到目前为止已完成的工作"

BMad-Help 检查你的项目，检测你已完成的内容，并确切地告诉你下一步该做什么。
:::

- **在工作流期间** — 智能体通过问题和解释引导你
- **社区** — [Discord](https://discord.gg/gk8jAdXWmj) (#bmad-method-help, #report-bugs-and-issues)

## 关键要点

:::tip[记住这些]
- **从 `/bmad-help` 开始** — 你的智能向导，了解你的项目和选项
- **始终使用新对话** — 为每个工作流开始新对话
- **路径很重要** — Quick Flow 使用 quick-spec；Method/Enterprise 需要 PRD 和架构
- **BMad-Help 自动运行** — 每个工作流结束时都会提供下一步的指导
:::

准备好开始了吗？安装 BMad，运行 `/bmad-help`，让你的智能向导为你引路。

---
## 术语说明

- **agent**：智能体。在人工智能与编程文档中，指具备自主决策或执行能力的单元。
- **epic**：史诗。软件开发中用于组织和管理大型功能或用户需求的高级工作项。
- **story**：故事。敏捷开发中的用户故事，描述用户需求的小型工作项。
- **PRD**：产品需求文档（Product Requirements Document）。详细描述产品功能、需求和目标的文档。
- **workflow**：工作流。一系列有序的任务或步骤，用于完成特定目标。
- **sprint**：冲刺。敏捷开发中的固定时间周期，用于完成预定的工作。
- **IDE**：集成开发环境（Integrated Development Environment）。提供代码编辑、调试等功能的软件工具。
- **artifact**：工件。软件开发过程中产生的文档、代码或其他可交付成果。
- **retrospective**：回顾。敏捷开发中的会议，用于反思和改进团队工作流程。
- **tech-spec**：技术规范（Technical Specification）。描述系统技术实现细节的文档。
- **UX**：用户体验（User Experience）。用户在使用产品过程中的整体感受和交互体验。
- **PM**：产品经理（Product Manager）。负责产品规划、需求管理和团队协调的角色。
- **SM**：Scrum Master。敏捷开发中的角色，负责促进 Scrum 流程和团队协作。
- **DEV**：开发者（Developer）。负责编写代码和实现功能的角色。
- **Architect**：架构师。负责系统架构设计和技术决策的角色。
- **Analyst**：分析师。负责需求分析、市场研究等工作的角色。
- **npx**：Node Package eXecute。Node.js 包执行器，用于运行 npm 包而无需安装。
- **Node.js**：基于 Chrome V8 引擎的 JavaScript 运行时环境。
- **Git**：分布式版本控制系统。
- **SaaS**：软件即服务（Software as a Service）。通过互联网提供软件服务的模式。
- **DevOps**：开发运维（Development and Operations）。强调开发和运维协作的实践和方法。
- **multi-tenant**：多租户。一种软件架构，允许单个实例为多个客户（租户）提供服务。
- **compliance**：合规性。遵守法律、法规和行业标准的要求。
</document>
