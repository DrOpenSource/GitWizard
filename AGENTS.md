# AGENTS.md — GitWizard Project Protocol

Welcome, Agent. You are developing **GitWizard**, an intent-based Git safety and orchestration extension for VS Code / Antigravity / Cursor designed specifically for "vibe coders".

---

## 1. Core Operating Principles

1. **Safety First**: Never execute destructive Git commands (`reset --hard`, `clean -fd`, `checkout -f`, `rebase`) without an automated snapshot checkpoint.
2. **Lean Context & Cost Optimization**:
   - Do not bloat context with large repetitive logs or dumps.
   - Read modular docs in `docs/` and skills in `.agents/skills/` on-demand using progressive disclosure.
   - Maintain project progress in `docs/ROADMAP.md` instead of re-listing plans in chat.
3. **Strict Verification**:
   - Every sprint feature must have automated unit tests (e.g., using Vitest / Mocha) testing edge cases (e.g., uncommitted untracked files, merge conflicts, detached HEAD).
   - Always run lint and type checks before marking a task complete.

---

## 2. Directory Layout & Standards

```
GitWizard/
├── .agents/                 # Antigravity/agent skills and workflows
│   └── skills/
│       ├── sprint-manager/  # Skill for managing sprint states and progress
│       └── git-safety/      # Skill for safe Git transaction patterns
├── docs/                    # Living architectural documentation
│   ├── ARCHITECTURE.md      # Extension architecture & Safety Engine design
│   └── ROADMAP.md           # Sprint status, backlog, and acceptance criteria
├── src/
│   ├── engine/              # Core Git safety engine (pure Node/TS, testable independently)
│   │   ├── snapshot.ts      # Shadow ref & working tree snapshot manager
│   │   ├── transaction.ts   # Command sequencer with rollback
│   │   └── git-client.ts    # Safe typed Git wrapper
│   ├── wizards/             # High-level intent flows (Checkpoint, Split, Sync, Undo)
│   ├── extension/           # VS Code extension entry point, commands, and providers
│   └── webview/             # Webview sidebar UI (Vibe-coder friendly visual wizard)
└── test/                    # Test suite with mock Git repositories
```

---

## 3. Sprint Delivery Workflow

For every sprint task:
1. Check `docs/ROADMAP.md` for current milestone and task criteria.
2. Implement code incrementally in `src/`.
3. Add corresponding unit/integration tests in `test/`.
4. Run tests and typecheck (`npm test`, `npm run compile`).
5. Update `docs/ROADMAP.md` with status and verified results.
