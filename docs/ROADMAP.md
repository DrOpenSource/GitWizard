# GitWizard — Development Roadmap & Sprint Tracker

This document tracks all milestones, sprints, and tasks for building the GitWizard VS Code / Antigravity extension.

---

## Sprint Overview

| Sprint | Goal | Target Status |
| :--- | :--- | :--- |
| **Sprint 1: Foundation & Safety Engine** | Scaffolding, TypeScript config, `GitClient`, `SnapshotManager`, `TransactionRunner`, unit tests | Completed (Verified) |
| **Sprint 2: Intent Wizard Orchestration** | Checkpoint, Splitter, Safe Sync, and Undo engine workflows with mock/test suites | Completed (Verified) |
| **Sprint 3: Extension Host & Webview UI** | Sidebar Webview Provider, message passing, responsive dark-mode UI, step-by-step wizard flow | Ready to Start |
| **Sprint 4: Integration & Packaging** | End-to-end testing in real Git repositories, packaging `.vsix` for VS Code / Antigravity / Cursor | Planned |

---

## Detailed Sprint Backlog

### Sprint 1: Foundation & Safety Engine
* **Objective**: Build a 100% reliable, zero-data-loss Git safety and transaction engine with automated test coverage.
* **Status**: Completed & Verified (7/7 tests passing in Vitest, build & typecheck clean)
* **Tasks**:
  - [x] **1.1 Project Setup**: `package.json`, TypeScript config (`tsconfig.json`), esbuild bundle script, Vitest setup for rapid unit testing.
  - [x] **1.2 Safe Git Wrapper (`GitClient`)**:
    - [x] `exec` helper with error formatting, timeouts, and sanitized outputs.
    - [x] Methods for status, branch listing, tree writing, diffing, and ref updates.
  - [x] **1.3 Snapshot Manager (`SnapshotManager`)**:
    - [x] Create shadow commit using `git stash create` / `git write-tree` without altering HEAD.
    - [x] Tag snapshot in `refs/gitwizard/snapshots/*`.
    - [x] Untracked file backup and tracking.
    - [x] Restore snapshot function with rollback verification.
  - [x] **1.4 Transaction Runner (`TransactionRunner`)**:
    - [x] Sequential step execution pipeline.
    - [x] Automatic abort of active Git states (`merge --abort`, `rebase --abort`).
    - [x] Automatic rollback on unexpected command failures.
  - [x] **1.5 Engine Unit Tests**:
    - [x] Test snapshot creation & restoration in isolated temporary git repos.
    - [x] Test transaction failure rollback guaranteeing no lost files.

### Sprint 2: Intent Wizards Logic
* **Objective**: Implement the 4 core vibe-coder wizard recipes on top of the Safety Engine.
* **Status**: Completed & Verified (17/17 tests passing in Vitest, UI & extension wired)
* **Tasks**:
  - [x] **2.1 Checkpoint Flow**: Instant one-click snapshot with user label, listing snapshots, one-click restore.
  - [x] **2.2 Branch Splitter Flow**: Take dirty working directory, partition files into Group A & Group B, create dedicated branches & commits cleanly.
  - [x] **2.3 Safe Remote Sync Flow**: Check remote tracking, snapshot dirty state, pull/rebase, detect conflict and cleanly abort back if needed.
  - [x] **2.4 Undo Flow**: Parse `git reflog` into human-friendly actions (e.g., "Merged branch X", "Committed Y") and safely unwind.

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
