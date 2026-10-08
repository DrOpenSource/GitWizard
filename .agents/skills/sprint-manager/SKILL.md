---
name: sprint-manager
description: >-
  Use this skill to plan, execute, and track project sprints, milestones, and task checklists. Ensures structured, production-ready delivery without token waste.
---

# Sprint Manager Skill

This skill enforces a lightweight, production-grade development lifecycle across sprints without incurring heavy multi-agent orchestration costs.

## When to Use
- Starting a new feature or phase.
- Breaking requirements into measurable sprints with acceptance criteria.
- Updating milestone progress and verifying delivery gates.

---

## 1. The Sprint Lifecycle

Every feature or milestone must follow this 4-step cadence:

```
[1. Align & Spec]  ──►  [2. Break into Tasks]  ──►  [3. Implement & Test]  ──►  [4. Verify Gate]
   (docs/ROADMAP.md)       (docs/ROADMAP.md)           (src/ + test/)             (npm test)
```

### Step 1: Align & Spec
Before writing code, verify:
* Are the technical inputs clearly defined?
* Is there an architecture spec in `docs/ARCHITECTURE.md`?
* What are the explicit edge cases (failures, rollbacks, errors)?

### Step 2: Task Checklist in ROADMAP.md
Maintain a clear markdown checklist in `docs/ROADMAP.md`:
* `[ ]` Not started
* `[/]` In progress
* `[x]` Completed and verified with tests

### Step 3: Incremental Implementation & Testing
* Keep code modular (e.g. decouple pure business logic from UI/VS Code APIs so logic can be tested in pure Node without launching a full VS Code instance).
* Add automated unit tests covering both the happy path and error rollback paths.

### Step 4: Verification Gate
Never mark a sprint or task as completed until:
1. All automated tests pass (`npm test`).
2. Build/typecheck succeeds without warnings (`npm run compile` or `tsc --noEmit`).
3. Changes are committed or snapshotted cleanly.
