# GitWizard — Development Roadmap & Sprint Tracker

This document tracks all milestones, sprints, and tasks for building the GitWizard VS Code / Antigravity extension.

---

## Sprint Overview

| Sprint | Goal | Target Status |
| :--- | :--- | :--- |
| **Sprint 1: Foundation & Safety Engine** | Scaffolding, TypeScript config, `GitClient`, `SnapshotManager`, `TransactionRunner`, unit tests | Completed (Verified) |
| **Sprint 2: Intent Wizard Orchestration** | Checkpoint, Splitter, Safe Sync, and Undo engine workflows with mock/test suites | Completed (Verified) |
| **Sprint 3: Extension Host & Webview UI** | Sidebar Webview Provider, message passing, responsive dark-mode UI, status bar indicator | Completed (Verified) |
| **Sprint 4: Integration & Packaging** | Packaging `.vsix` for VS Code / Antigravity / Cursor, verification, and documentation | Completed (Verified) |
| **Sprint 5: Vibe-First Ergonomics & Auto-Flight Recorder** | Daily essentials, background auto-checkpoints, virtual timeline rewind tree, plain-English action approvals | Completed (Verified) |

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
* **Status**: Completed & Verified (Sidebar Webview Provider, live Status Bar item, dark theme)
* **Tasks**:
  - [x] **3.1 VS Code Extension Manifest**: Register activity bar view container, view, commands, status bar items.
  - [x] **3.2 Webview View Provider**: Two-way communication protocol (`postMessage`) between UI and Extension Host.
  - [x] **3.3 UI Component System**: Clean, dark-mode native interface styled with VS Code CSS variables.
  - [x] **3.4 Wizard Interactive Steps**: Visual file selector for Branch Splitter, confirmation preview before actions run, progress indicator, error banner with 1-click restore.

### Sprint 4: Polish, Packaging & Verification
* **Objective**: Verify against real-world test scenarios and package the extension.
* **Status**: Completed & Verified (gitwizard-0.1.0.vsix generated, 560KB, zero warnings)
* **Tasks**:
  - [x] **4.1 Real-World E2E Scenarios**: Tested dirty merge conflicts, untracked large assets, detached HEAD states in Vitest.
  - [x] **4.2 Build & Bundle**: esbuild bundle configuration for extension and webview.
  - [x] **4.3 VSIX Packaging**: Produced `gitwizard-0.1.0.vsix` ready to install in Antigravity, VS Code, and Cursor.
  - [x] **4.4 User Documentation**: Comprehensive README.md quickstart guide and demo walkthrough.

### Sprint 5: Vibe-First Ergonomics & Auto-Flight Recorder
* **Objective**: Eliminate user confusion by introducing Daily Essentials, Passive Auto-Checkpoints, a Virtual Timeline Tree, and Plain-English Action Approvals.
* **Status**: Completed & Verified (20/20 unit tests passing, gitwizard-0.2.0.vsix packaged)
* **Tasks**:
  - [x] **5.1 Daily Essentials Wizard (`src/wizards/essentials.ts`)**: Safe commit, push, pull, uncommit (soft reset preserving 100% of local modifications), and branch switching.
  - [x] **5.2 Auto-Checkpoint Controller (`src/engine/auto-checkpoint.ts`)**: Passive debounced shadow snapshots before AI prompt edits with rolling window pruning.
  - [x] **5.3 Webview UI Revamp (`src/webview/App.tsx`)**:
    - [x] Daily Essentials deck (Save / Push / Pull / Branch / Uncommit).
    - [x] Interactive Virtual Timeline Tree (visual nodes with 1-click rewind).
    - [x] Plain-English Action Preview & Confirmation modal.
    - [x] Visual dirty file grouping overview.
  - [x] **5.4 Automated Verification**: Vitest unit test suite covering essentials & auto-checkpoints (4 new tests passing, 20/20 total tests across all suites).
  - [x] **5.5 Packaging Release**: Rebuild and package `gitwizard-0.2.0.vsix`.
