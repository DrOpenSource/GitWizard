---
name: project-kickoff
description: >-
  Use this skill whenever starting a new project, initializing an empty repository, or beginning a major system rewrite. Ensures structured alignment before code is written.
---

# Project Kickoff & Alignment Skill

This skill defines the standardized, low-cost kickoff protocol for any new software project in Antigravity or Claude Code.

---

## The Kickoff Flow

When an agent detects a new or uninitialized project, it must **never start writing code blindly**. Instead, it executes this 3-step sequence:

```
[1. Detect Empty/New Project]
              │
              ▼
[2. Present Alignment Questionnaire (Ask Questions)]
    - Target Environment & Form Factor
    - Core Tech Stack & Bundler
    - UI/Styling System
    - Testing & Verification Strategy
              │
              ▼
[3. Scaffold Lean Artifacts]
    - AGENTS.md (Project protocol)
    - docs/ARCHITECTURE.md (System design)
    - docs/ROADMAP.md (Sprint backlog)
```

---

## Standard Alignment Questions

1. **Target Environment**:
   - Web App / Backend Service / VS Code Extension / CLI / Mobile
2. **Tech Stack & Language**:
   - TypeScript (strict) / Python / Go / Rust
3. **UI / Styling Philosophy**:
   - Editor-native (VS Code CSS tokens) / Tailwind CSS / Vanilla CSS / UI Toolkit
4. **Testing & Verification Standard**:
   - Vitest / Jest / Pytest / Go test (automated unit tests before completing any task)

---

## Scaffolding Checklist

Once aligned, the agent generates:
1. `AGENTS.md` (Lightweight core rules, under 100 lines to minimize token context).
2. `docs/ARCHITECTURE.md` (Decoupled domain engine + interface layer).
3. `docs/ROADMAP.md` (Clear sprint phases with task checklists: `[ ]`, `[/]`, `[x]`).
4. Initialize package/dependency config (`package.json`, `tsconfig.json`, etc.).
