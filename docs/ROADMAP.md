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

### Sprint 6: Hardening, Test Gap Closure & v1.0.0 Stable Release
* **Objective**: Audit complete test coverage, close all HIGH/MEDIUM testing gaps, eliminate bugs in flight recording & index handling, and deliver rock-solid v1.0.0 stable release.
* **Status**: Completed & Verified (55/55 unit tests passing across 10 test suites, gitwizard-1.0.0.vsix packaged)
* **Tasks**:
  - [x] **6.1 Comprehensive Coverage Audit**: Identified 19 gaps across engine and wizards; expanded test suite from 23 to 55 passing tests.
  - [x] **6.2 AutoCheckpointController Dedicated Suite (`test/engine/auto-checkpoint.test.ts`)**: 9 tests covering debounce scheduling, concurrent capture locks (`_isCapturing`), capacity pruning, and duplicate tree SHA skipping.
  - [x] **6.3 Shadow Index Isolation Bugfix (`src/engine/snapshot.ts`)**: Isolate all snapshot creation and working tree SHA checks with `GIT_INDEX_FILE`, eliminating accidental index staging.
  - [x] **6.4 Core Safety Isolation Tests (`test/engine/git-client.test.ts`)**: Direct isolation tests for `abortInProgress` (clean & active merge conflict), `resetHard`, `deleteRef`, `stashCreate`, and detached HEAD detection.
  - [x] **6.5 Reflog Time Machine Edge Cases (`test/wizards/undo.test.ts`)**: Arbitrary selector rewinds (`HEAD@{2}`), invalid selector error rollback recovery, and reflog categorization (checkout, reset, amend, merge).
  - [x] **6.6 SafeSync Stash-Pop Conflict Path (`test/wizards/sync.test.ts`)**: Stash pop conflict simulation with uncommitted local modifications and clean merge strategy execution.
  - [x] **6.7 Daily Essentials Remote Integration (`test/wizards/essentials.test.ts`)**: Safe push, safe pull, and invalid branch switching error handling.
  - [x] **6.8 Splitter Edge Validation (`test/wizards/split.test.ts` & `test/wizards/publish.test.ts`)**: Empty group, empty commit message, and empty files validation; temporary remote cleanup on push failure.
  - [x] **6.9 Transaction Step-Level Rollback (`test/engine/transaction.test.ts`)**: Verified reverse-order invocation of individual step rollbacks on mid-transaction failure.
  - [x] **6.10 Command Palette Manifest Complete (`package.json` & `src/extension/index.ts`)**: Registered `gitwizard.undoLast`, `gitwizard.splitToNewRepo`, `gitwizard.pushMain`, and `gitwizard.splitChanges`.
  - [x] **6.11 Open Source Documentation**: Authored `CHANGELOG.md` and `CONTRIBUTING.md`.
  - [x] **6.12 Packaging & Release**: Version bumped to `1.0.0`, verified with zero TypeScript errors and packaged `gitwizard-1.0.0.vsix`.

---

---

## 🚀 GitWizard Pro — Master Implementation Plan ($49 Lifetime / $29 Early Bird)

> **Commercial Model**: **$49 One-Time Lifetime License** (Launch Special: **$29**, Zero Subscriptions).  
> **Core Architecture**: Zero-COGS, client-side execution, Bring-Your-Own-Key (BYOK) AI, and private GitHub storage sync.  
> **Reference Specs**: Complete user journeys and UX designs in [docs/PRO_SPECIFICATION.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/GitWizard/docs/PRO_SPECIFICATION.md).

---

### Sprint 7: Pro Foundation, Offline Cryptographic Licensing & AI Semantic Commit/PR Generator
* **Objective**: Build the offline cryptographic licensing engine (14-day zero-card trial) and the #1 daily vibe-coder superpower: AI-generated conventional commits and PR summaries.
* **Status**: ⏳ Ready for Development
* **Milestone Version**: `v1.1.0`

#### Chunks & Trackable To-Dos:
- [ ] **Chunk 7.1: Cryptographic Offline License Engine (`src/pro/license.ts`)**
  - [ ] Implement Ed25519 / HMAC-SHA256 signature verification in Node.js `crypto`.
  - [ ] Implement format parser: `GWPRO-LIFETIME-<emailBase64>-<issuedTimestamp>-<signature>`.
  - [ ] Implement 14-day local trial with tamper-resistant local state in VS Code GlobalState.
  - [ ] Implement graceful fallback: If license is invalid or trial expires, Free Tier remains 100% active; NEVER lock user out of repositories.
  - [ ] **Extensive Testing Suite (`test/pro/license.test.ts`)**:
    - [ ] `valid-license`: Successfully verifies authentic signed key.
    - [ ] `tampered-key`: Rejects modified payload or corrupted signature.
    - [ ] `trial-active`: Reports active trial with remaining days calculated correctly.
    - [ ] `trial-expired`: Reports expired trial and falls back to Free tier without throwing errors.
    - [ ] `clock-rollback`: Detects local system clock manipulation attempt.
    - [ ] `empty-and-malformed`: Rejects arbitrary strings, whitespace, or invalid base64.

- [ ] **Chunk 7.2: Provider-Agnostic AI Service (`src/pro/ai-service.ts`)**
  - [ ] Create unified `AIService` interface with support for Google Gemini, OpenAI (`gpt-4o-mini`), and local Ollama.
  - [ ] Store API keys securely in VS Code `SecretStorage`.
  - [ ] Implement token estimation and automatic diff truncation (>12,000 tokens trimmed cleanly).
  - [ ] Filter out lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) and binary assets from diff prompts.
  - [ ] **Extensive Testing Suite (`test/pro/ai-service.test.ts`)**:
    - [ ] `gemini-provider`: Successful prompt and response formatting.
    - [ ] `openai-provider`: Successful prompt and response formatting.
    - [ ] `ollama-local`: Fallback to local HTTP endpoint when offline.
    - [ ] `missing-api-key`: Friendly error prompting user to enter key in settings.
    - [ ] `rate-limit-429`: Automatic exponential backoff retry.
    - [ ] `diff-pruning`: Correctly strips 50,000-line lockfiles while preserving code diffs.

- [ ] **Chunk 7.3: AI Semantic Conventional Commit & PR Generator (`src/wizards/ai-commit.ts`)**
  - [ ] Create `AICommitWizard` analyzing staged + unstaged diffs.
  - [ ] Enforce conventional commit output format: `type(scope): summary` + bulleted changes.
  - [ ] Generate structured PR description: `Problem`, `Solution`, `Impact`, `Testing`.
  - [ ] **Extensive Testing Suite (`test/wizards/ai-commit.test.ts`)**:
    - [ ] `single-file-commit`: Generates concise semantic message for single-file diff.
    - [ ] `multi-file-commit`: Accurately groups multi-file changes under correct scope.
    - [ ] `empty-diff`: Gracefully warns user when workspace is clean.
    - [ ] `untracked-files`: Reads content of new untracked files into diff context.
    - [ ] `malformed-llm-response`: Fallbacks gracefully to fallback message if LLM returns garbage.

- [ ] **Chunk 7.4: Webview UI Integration (`src/webview/App.tsx`)**
  - [ ] Add `[✨ Generate with AI]` button in the Daily Essentials Commit Card.
  - [ ] Add editable preview textarea so the user can tweak the generated commit message before saving.
  - [ ] Add Pro Status indicator badge in sidebar header with "Activate License" modal.
  - [ ] Add loading spinner and error alert banner for AI generation.

---

### Sprint 8: Pre-Flight Secret Radar & Production Branch Guard
* **Objective**: Protect vibe coders from catastrophic API key leaks and accidental commits to `main`.
* **Status**: 📋 Backlog
* **Milestone Version**: `v1.2.0`

#### Chunks & Trackable To-Dos:
- [ ] **Chunk 8.1: High-Performance Secret Scanner (`src/pro/secret-scanner.ts`)**
  - [ ] Implement regex pattern catalog: OpenAI, Stripe (live/test), AWS access keys, GitHub PATs, Gemini, Anthropic, Slack tokens, private keys (`-----BEGIN PRIVATE KEY-----`), database connection strings (`postgres://`, `mongodb://`).
  - [ ] Implement Shannon entropy evaluator to detect arbitrary high-entropy secrets without known prefixes.
  - [ ] Benchmark scanner to guarantee diff evaluation in **< 100ms**.
  - [ ] **Extensive Testing Suite (`test/pro/secret-scanner.test.ts`)**:
    - [ ] `openai-key`: Detects `sk-proj-...` and `sk-admin-...`.
    - [ ] `stripe-live-key`: Detects `sk_live_...` and `rk_live_...` while ignoring test keys if configured.
    - [ ] `aws-credentials`: Detects `AKIA...` and secret access keys.
    - [ ] `entropy-detector`: Catches raw 40-character random base64/hex secrets.
    - [ ] `false-positives`: Ignores UUIDs, git commit hashes, SHA-256 hashes of test assets, and camelCase variable names.
    - [ ] `multiline-secrets`: Detects PEM private keys spanning multiple lines.

- [ ] **Chunk 8.2: 1-Click Secret Remediation Engine (`src/pro/secret-remediation.ts`)**
  - [ ] Implement 1-Click action: `[🔒 Extract to .env & Add to .gitignore]`.
  - [ ] Parse source file AST/text, replace literal secret with `process.env.VARIABLE_NAME`.
  - [ ] Create or update `.env` with the extracted key-value pair.
  - [ ] Verify `.env` is listed in `.gitignore` (appends it if missing).
  - [ ] **Extensive Testing Suite (`test/pro/secret-remediation.test.ts`)**:
    - [ ] `new-env-file`: Creates `.env` and adds to `.gitignore` when neither exists.
    - [ ] `existing-env-file`: Appends new variable without clobbering existing `.env` variables.
    - [ ] `already-ignored`: Does not add duplicate `.env` entries to `.gitignore`.
    - [ ] `multiple-secrets`: Simultaneously extracts 3 different secrets in one pass.
    - [ ] `atomic-rollback`: If writing `.env` fails, source file edit is reverted cleanly.

- [ ] **Chunk 8.3: Production Branch Guard (`src/pro/branch-guard.ts`)**
  - [ ] Intercept direct commits, resets, and pushes when active branch is in protected list (`main`, `master`, `production`, `release/*`).
  - [ ] 1-Click action: `[🛡️ Create Feature Branch Instead]`.
  - [ ] Auto-suggests feature branch name based on uncommitted changes.
  - [ ] **Extensive Testing Suite (`test/pro/branch-guard.test.ts`)**:
    - [ ] `protected-commit-blocked`: Intercepts `safeCommit()` on `main` and leaves files uncommitted.
    - [ ] `protected-reset-blocked`: Intercepts hard resets on `main`.
    - [ ] `redirect-to-feature`: Creates new branch, moves changes, and verifies `main` remains untouched.
    - [ ] `allow-override`: Supports explicit "Commit Anyway" modal confirmation for power users.

---

### Sprint 9: Surgical Per-File Rewind & AI Auto-Splitter
* **Objective**: Enable single-file surgical time travel and multi-branch AI clustering for 20-file AI prompt sessions.
* **Status**: 📋 Backlog
* **Milestone Version**: `v1.3.0`

#### Chunks & Trackable To-Dos:
- [ ] **Chunk 9.1: Surgical File Rewind Engine (`src/pro/file-rewind.ts`)**
  - [ ] Implement single-file restore: `git checkout refs/gitwizard/snapshots/<snapId> -- <filePath>`.
  - [ ] Verify main index and other modified files are 100% untouched.
  - [ ] Take pre-restore safety snapshot of the single file before overwriting.
  - [ ] **Extensive Testing Suite (`test/pro/file-rewind.test.ts`)**:
    - [ ] `single-modified-file`: Restores 1 modified file while leaving 5 other modified files intact.
    - [ ] `single-deleted-file`: Restores a file that was deleted from disk back to its snapshot state.
    - [ ] `single-untracked-file`: Overwrites untracked file cleanly if snapshot had a prior version.
    - [ ] `non-existent-file-in-snap`: Throws descriptive error without corrupting working tree.
    - [ ] `special-characters-in-path`: Handles spaces, unicode, and nested folder paths cleanly.

- [ ] **Chunk 9.2: Semantic AI Multi-Branch Auto-Splitter (`src/pro/ai-splitter.ts`)**
  - [ ] 1-Click Button: `[✨ Auto-Split into PRs]`.
  - [ ] Analyzes AST, file paths, and import dependencies across all modified files.
  - [ ] Uses LLM to cluster changes into 2–3 logical PR groups (e.g. backend routes vs frontend components).
  - [ ] Previews interactive split card with checkboxes.
  - [ ] Executes sequential branching and isolated staging via `TransactionRunner`.
  - [ ] **Extensive Testing Suite (`test/pro/ai-splitter.test.ts`)**:
    - [ ] `2-group-cluster`: Successfully clusters 8 backend + 6 frontend files into 2 distinct branches.
    - [ ] `dependency-ordering`: Ensures shared utility files are grouped with their primary dependents.
    - [ ] `single-file-boundary`: Bypasses split and informs user when changes only belong to 1 feature.
    - [ ] `transaction-abort`: Rolls back to original working tree state if user aborts or git command fails.

- [ ] **Chunk 9.3: Webview Interactive Cards**
  - [ ] Right-click context menu on file nodes in the Virtual Timeline Tree (`Rewind File`).
  - [ ] Auto-Split preview modal in the Branch Splitter view.

---

### Sprint 10: Smart AI Conflict Resolver & Private GitHub Cloud Sync
* **Objective**: Eliminate merge conflict dread and deliver cross-device encrypted cloud backup.
* **Status**: 📋 Backlog
* **Milestone Version**: `v2.0.0` (GitWizard Pro Commercial Launch)

#### Chunks & Trackable To-Dos:
- [ ] **Chunk 10.1: Smart 3-Way AI Conflict Resolver (`src/pro/conflict-resolver.ts`)**
  - [ ] Extract `BASE` common ancestor, `OURS` (local changes), and `THEIRS` (incoming changes) from Git index.
  - [ ] Feed all 3 representations to LLM with semantic resolution prompt.
  - [ ] Verify generated code has 0 conflict markers and passes basic syntax checks.
  - [ ] Present visual side-by-side diff in Webview: Left (Conflict/Incoming) vs Right (AI Resolution).
  - [ ] **Extensive Testing Suite (`test/pro/conflict-resolver.test.ts`)**:
    - [ ] `identical-line-conflict`: Resolves overlapping edits to the same function cleanly.
    - [ ] `import-conflict`: Merges disjoint imports from both branches into single clean import block.
    - [ ] `deleted-vs-modified`: Resolves conflict where one branch deleted code while other edited it.
    - [ ] `syntax-validation`: Catches hallucinated syntax and aborts before touching repository.
    - [ ] `safety-airbag`: Restores original pre-sync state if user rejects resolution.

- [ ] **Chunk 10.2: Private GitHub Cloud Sync Bridge (`src/pro/cloud-sync.ts`)**
  - [ ] Create zero-COGS cloud backup by pushing client-side AES-256 encrypted git bundles to a private hidden orphan branch (`refs/gitwizard/cloud-sync`) on the user's existing GitHub repo.
  - [ ] Sync snapshot metadata JSON across linked developer machines.
  - [ ] **Extensive Testing Suite (`test/pro/cloud-sync.test.ts`)**:
    - [ ] `encrypt-and-bundle`: Creates valid encrypted git bundle packfile.
    - [ ] `decrypt-and-restore`: Reconstitutes snapshots on fresh mock repository.
    - [ ] `tamper-detection`: Rejects corrupted or modified encrypted bundles.
    - [ ] `offline-graceful`: Detects network absence and queues sync for later without blocking editor.

- [ ] **Chunk 10.3: Webview 3-Way Visual Resolution Card**
  - [ ] Interactive conflict preview card with 1-click `[Accept Resolution & Finish Sync]`.

- [ ] **Chunk 10.4: v2.0.0 Packaging, Landing Page & Marketplace Launch**
  - [ ] Package `gitwizard-2.0.0.vsix` with Pro licensing assets.
  - [ ] Update `README.md`, `CHANGELOG.md`, and Polar.sh / LemonSqueezy store links.



