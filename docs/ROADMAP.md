# GitWizard — Development Roadmap & Sprint Tracker

This document tracks all milestones, sprints, and tasks for building the GitWizard VS Code / Antigravity extension.

---

## Sprint Overview

| Sprint | Goal | Target Status |
| :--- | :--- | :--- |
| **Sprint 1: Foundation & Safety Engine** | Scaffolding, TypeScript config, `GitClient`, `SnapshotManager`, `TransactionRunner`, unit tests | Ready to Start |
| **Sprint 2: Intent Wizard Orchestration** | Checkpoint, Splitter, Safe Sync, and Undo engine workflows with mock/test suites | Planned |
| **Sprint 3: Extension Host & Webview UI** | Sidebar Webview Provider, message passing, responsive dark-mode UI, step-by-step wizard flow | Planned |
| **Sprint 4: Integration & Packaging** | End-to-end testing in real Git repositories, packaging `.vsix` for VS Code / Antigravity / Cursor | Planned |

---

## Detailed Sprint Backlog

### Sprint 1: Foundation & Safety Engine
* **Objective**: Build a 100% reliable, zero-data-loss Git safety and transaction engine with automated test coverage.
* **Tasks**:
  - [ ] **1.1 Project Setup**: `package.json`, TypeScript config (`tsconfig.json`), ESLint, Vitest setup for rapid unit testing.
  - [ ] **1.2 Safe Git Wrapper (`GitClient`)**:
    - [ ] `execGit` helper with error formatting, timeouts, and sanitized outputs.
    - [ ] Methods for status, branch listing, tree writing, diffing, and ref updates.
  - [ ] **1.3 Snapshot Manager (`SnapshotManager`)**:
    - [ ] Create shadow commit using `git stash create` / `git write-tree` without altering HEAD.
    - [ ] Tag snapshot in `refs/gitwizard/snapshots/*`.
    - [ ] Untracked file backup and tracking.
    - [ ] Restore snapshot function with rollback verification.
  - [ ] **1.4 Transaction Runner (`TransactionRunner`)**:
    - [ ] Sequential step execution pipeline.
    - [ ] Automatic abort of active Git states (`merge --abort`, `rebase --abort`).
    - [ ] Automatic rollback on unexpected command failures.
  - [ ] **1.5 Engine Unit Tests**:
    - [ ] Test snapshot creation & restoration in isolated temporary git repos.
    - [ ] Test transaction failure rollback guaranteeing no lost files.

### Sprint 2: Intent Wizards Logic
* **Objective**: Implement the 4 core vibe-coder wizard recipes on top of the Safety Engine.
* **Tasks**:
  - [ ] **2.1 Checkpoint Flow**: Instant one-click snapshot with user label, listing snapshots, one-click restore.
  - [ ] **2.2 Branch Splitter Flow**: Take dirty working directory, partition files into Group A & Group B, create dedicated branches & commits cleanly.
  - [ ] **2.3 Safe Remote Sync Flow**: Check remote tracking, snapshot dirty state, pull/rebase, detect conflict and cleanly abort back if needed.
  - [ ] **2.4 Undo Flow**: Parse `git reflog` into human-friendly actions (e.g., "Merged branch X", "Committed Y") and safely unwind.

### Sprint 3: Extension Host & Webview UI
* **Objective**: Build the user-facing UI in VS Code Activity Bar with a seamless, theme-aware wizard interface.
* **Tasks**:
  - [ ] **3.1 VS Code Extension Manifest**: Register activity bar view container, view, commands, status bar items.
  - [ ] **3.2 Webview View Provider**: Two-way communication protocol (`postMessage`) between UI and Extension Host.
  - [ ] **3.3 UI Component System**: Clean, dark-mode native interface styled with VS Code CSS variables.
  - [ ] **3.4 Wizard Interactive Steps**: Visual file selector for Branch Splitter, confirmation preview before actions run, progress indicator, error banner with 1-click restore.

### Sprint 4: Polish, Packaging & Verification
* **Objective**: Verify against real-world test scenarios and package the extension.
* **Tasks**:
  - [ ] **4.1 Real-World E2E Scenarios**: Test dirty merge conflicts, untracked large assets, detached HEAD states.
  - [ ] **4.2 Build & Bundle**: Vite/esbuild bundle configuration for extension and webview.
  - [ ] **4.3 VSIX Packaging**: Produce test `.vsix` ready to install in Antigravity, VS Code, and Cursor.
  - [ ] **4.4 User Documentation**: Quickstart guide and demo walkthrough.
