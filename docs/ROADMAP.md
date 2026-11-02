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
| **Sprint 6: Hardening & v1.0.0 Stable Release** | Full test coverage audit, shadow index isolation bugfix, reflog edge cases, 55 unit tests | Completed (Verified) |
| **Sprint 7: Pro Licensing & AI Commit Drafter** | Offline HMAC licensing, 14-day zero-card trial, multi-provider AI service (Gemini/OpenAI/Ollama) | Completed (Verified) |
| **Sprint 8: Pre-Flight Secret Radar & Branch Guard** | Sub-25ms secret scanning, 1-click .env remediation, protected branch intercept on `main` | Completed (Verified) |
| **Sprint 9: Surgical File Rewind & AI Auto-Splitter** | Per-file rollback, multi-branch AST semantic clustering, 101 unit tests | Completed (Verified) |
| **Sprint 10: Smart AI Conflict Resolver & Cloud Sync** | 3-way conflict resolver, AES-256 encrypted private cloud sync, v2.0.0 release | Completed (Verified) |
| **Sprint 11: The Vibe-First UX Transformation** | 5-phase onboarding, empty state airbag, de-jargonization, guided GitHub sync, Playbook guide | Completed (Verified) |
| **Sprint 12: Visual Diff Inspector (P7) & 1-Click PR Creator** | Virtual snapshot document provider, native side-by-side diffing, automated GitHub PR creator | Completed (Verified) |

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

## 🚀 GitWizard Pro — Master Implementation Plan ($49 Lifetime / $29 Early Bird)

> **Commercial Model**: **$49 One-Time Lifetime License** (Launch Special: **$29**, Zero Subscriptions).  
> **Core Architecture**: Zero-COGS, client-side execution, Bring-Your-Own-Key (BYOK) AI, and private GitHub storage sync.  
> **Reference Specs**: Complete user journeys and UX designs in [docs/PRO_SPECIFICATION.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/GitWizard/docs/PRO_SPECIFICATION.md).

---

### Sprint 7: Pro Foundation, Offline Cryptographic Licensing & AI Semantic Commit/PR Generator
* **Objective**: Build the offline cryptographic licensing engine (14-day zero-card trial) and the #1 daily vibe-coder superpower: AI-generated conventional commits and PR summaries.
* **Status**: Completed & Verified (74/74 unit tests passing across 13 test suites)
* **Milestone Version**: `v1.1.0`

#### Chunks & Trackable To-Dos:
- [x] **Chunk 7.1: Cryptographic Offline License Engine (`src/pro/license.ts`)**
  - [x] Implement Ed25519 / HMAC-SHA256 signature verification in Node.js `crypto`.
  - [x] Implement format parser: `GWPRO-LIFETIME.<emailBase64>.<issuedTimestamp>.<signature>`.
  - [x] Implement 14-day local trial with tamper-resistant local state in VS Code GlobalState.
  - [x] Implement graceful fallback: If license is invalid or trial expires, Free Tier remains 100% active; NEVER lock user out of repositories.
  - [x] **Extensive Testing Suite (`test/pro/license.test.ts`)**:
    - [x] `valid-license`: Successfully verifies authentic signed key.
    - [x] `tampered-key`: Rejects modified payload or corrupted signature.
    - [x] `trial-active`: Reports active trial with remaining days calculated correctly.
    - [x] `trial-expired`: Reports expired trial and falls back to Free tier without throwing errors.
    - [x] `clock-rollback`: Detects local system clock manipulation attempt.
    - [x] `empty-and-malformed`: Rejects arbitrary strings, whitespace, or invalid base64.

- [x] **Chunk 7.2: Provider-Agnostic AI Service (`src/pro/ai-service.ts`)**
  - [x] Create unified `AIService` interface with support for Google Gemini, OpenAI (`gpt-4o-mini`), and local Ollama.
  - [x] Store API keys securely in VS Code `SecretStorage` / configuration.
  - [x] Implement token estimation and automatic diff truncation (>12,000 tokens trimmed cleanly).
  - [x] Filter out lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) and binary assets from diff prompts.
  - [x] **Extensive Testing Suite (`test/pro/ai-service.test.ts`)**:
    - [x] `gemini-provider`: Successful prompt and response formatting.
    - [x] `openai-provider`: Successful prompt and response formatting.
    - [x] `ollama-local`: Fallback to local HTTP endpoint when offline.
    - [x] `missing-api-key`: Friendly error prompting user to enter key in settings.
    - [x] `rate-limit-429`: Automatic exponential backoff retry.
    - [x] `diff-pruning`: Correctly strips 50,000-line lockfiles while preserving code diffs.

- [x] **Chunk 7.3: AI Semantic Conventional Commit & PR Generator (`src/wizards/ai-commit.ts`)**
  - [x] Create `AICommitWizard` analyzing staged + unstaged diffs.
  - [x] Enforce conventional commit output format: `type(scope): summary` + bulleted changes.
  - [x] Generate structured PR description: `Problem`, `Solution`, `Impact`, `Testing`.
  - [x] **Extensive Testing Suite (`test/wizards/ai-commit.test.ts`)**:
    - [x] `single-file-commit`: Generates concise semantic message for single-file diff.
    - [x] `multi-file-commit`: Accurately groups multi-file changes under correct scope.
    - [x] `empty-diff`: Gracefully warns user when workspace is clean.
    - [x] `untracked-files`: Reads content of new untracked files into diff context.
    - [x] `malformed-llm-response`: Fallbacks gracefully to fallback message if LLM returns garbage.

- [x] **Chunk 7.4: Webview UI Integration (`src/webview/App.tsx` & `src/extension/index.ts`)**
  - [x] Add `[✨ AI Message]` button in the Daily Essentials Commit Card.
  - [x] Add editable preview textarea so the user can tweak the generated commit message before saving.
  - [x] Add Pro Status indicator badge in sidebar header with "Activate License" modal.
  - [x] Add loading spinner and error alert banner for AI generation.
  - [x] Registered `gitwizard.generateAICommit`, `gitwizard.activateLicense`, and `gitwizard.configureAI` commands.

---

### Sprint 8: Pre-Flight Secret Radar & Production Branch Guard
* **Objective**: Protect vibe coders from catastrophic API key leaks and accidental commits to `main`.
* **Status**: Completed & Verified (91/91 unit tests passing across 16 test suites)
* **Milestone Version**: `v1.2.0`

#### Chunks & Trackable To-Dos:
- [x] **Chunk 8.1: High-Performance Secret Scanner (`src/pro/secret-scanner.ts`)**
  - [x] Implement regex pattern catalog: OpenAI, Stripe (live/test), AWS access keys, GitHub PATs, Gemini, Anthropic, Slack tokens, private keys (`-----BEGIN PRIVATE KEY-----`), database connection strings (`postgres://`, `mongodb://`).
  - [x] Implement Shannon entropy evaluator to detect arbitrary high-entropy secrets without known prefixes.
  - [x] Benchmark scanner to guarantee diff evaluation in **< 100ms** (actual: 12ms–23ms).
  - [x] **Extensive Testing Suite (`test/pro/secret-scanner.test.ts`)**:
    - [x] `openai-key`: Detects `sk-proj-...` and `sk-admin-...`.
    - [x] `stripe-live-key`: Detects `sk_live_...` and `rk_live_...` while ignoring test keys if configured.
    - [x] `aws-credentials`: Detects `AKIA...` and secret access keys.
    - [x] `entropy-detector`: Catches raw 40-character random base64/hex secrets.
    - [x] `false-positives`: Ignores UUIDs, git commit hashes, SHA-256 hashes of test assets, and camelCase variable names.
    - [x] `multiline-secrets`: Detects PEM private keys spanning multiple lines.

- [x] **Chunk 8.2: 1-Click Secret Remediation Engine (`src/pro/secret-remediation.ts`)**
  - [x] Implement 1-Click action: `[🔒 Extract to .env & Add to .gitignore]`.
  - [x] Parse source file AST/text, replace literal secret with `process.env.VARIABLE_NAME`.
  - [x] Create or update `.env` with the extracted key-value pair.
  - [x] Verify `.env` is listed in `.gitignore` (appends it if missing).
  - [x] **Extensive Testing Suite (`test/pro/secret-remediation.test.ts`)**:
    - [x] `new-env-file`: Creates `.env` and adds to `.gitignore` when neither exists.
    - [x] `existing-env-file`: Appends new variable without clobbering existing `.env` variables.
    - [x] `already-ignored`: Does not add duplicate `.env` entries to `.gitignore`.
    - [x] `multiple-secrets`: Simultaneously extracts 3 different secrets in one pass.
    - [x] `atomic-rollback`: If writing `.env` fails, source file edit is reverted cleanly.

- [x] **Chunk 8.3: Production Branch Guard (`src/pro/branch-guard.ts`)**
  - [x] Intercept direct commits, resets, and pushes when active branch is in protected list (`main`, `master`, `production`, `release/*`).
  - [x] 1-Click action: `[🛡️ Create Feature Branch Instead]`.
  - [x] Auto-suggests feature branch name based on uncommitted changes.
  - [x] **Extensive Testing Suite (`test/pro/branch-guard.test.ts`)**:
    - [x] `protected-commit-blocked`: Intercepts `safeCommit()` on `main` and leaves files uncommitted.
    - [x] `protected-reset-blocked`: Intercepts hard resets on `main`.
    - [x] `redirect-to-feature`: Creates new branch, moves changes, and verifies `main` remains untouched.
    - [x] `allow-override`: Supports explicit "Commit Anyway" modal confirmation for power users.

---

### Sprint 9: Surgical Per-File Rewind & AI Auto-Splitter
* **Objective**: Enable single-file surgical time travel and multi-branch AI clustering for 20-file AI prompt sessions.
* **Status**: Completed & Verified (101/101 unit tests passing across 18 test suites)
* **Milestone Version**: `v1.3.0`

#### Chunks & Trackable To-Dos:
- [x] **Chunk 9.1: Surgical File Rewind Engine (`src/pro/file-rewind.ts`)**
  - [x] Implement single-file restore: `git checkout <snapSha> -- <filePath>`.
  - [x] Verify main index and other modified files are 100% untouched.
  - [x] Take pre-restore safety snapshot of the single file before overwriting.
  - [x] **Extensive Testing Suite (`test/pro/file-rewind.test.ts`)**:
    - [x] `single-modified-file`: Restores 1 modified file while leaving 5 other modified files intact.
    - [x] `single-deleted-file`: Restores a file that was deleted from disk back to its snapshot state.
    - [x] `single-untracked-file`: Overwrites untracked file cleanly if snapshot had a prior version.
    - [x] `non-existent-file-in-snap`: Throws descriptive error without corrupting working tree.
    - [x] `special-characters-in-path`: Handles spaces, unicode, and nested folder paths cleanly.

- [x] **Chunk 9.2: Semantic AI Multi-Branch Auto-Splitter (`src/pro/ai-splitter.ts`)**
  - [x] 1-Click Button: `[✨ Auto-Split into PRs]`.
  - [x] Analyzes AST, file paths, and import dependencies across all modified files.
  - [x] Uses LLM to cluster changes into 2–3 logical PR groups (e.g. backend routes vs frontend components) with deterministic heuristic fallback.
  - [x] Previews interactive split card with checkboxes.
  - [x] Executes sequential branching and isolated staging via `TransactionRunner`.
  - [x] **Extensive Testing Suite (`test/pro/ai-splitter.test.ts`)**:
    - [x] `2-group-cluster`: Successfully clusters backend + frontend files into distinct branches.
    - [x] `dependency-ordering`: Ensures shared utility files are grouped with their primary dependents.
    - [x] `single-file-boundary`: Bypasses split and informs user when changes only belong to 1 feature.
    - [x] `transaction-abort`: Rolls back to original working tree state if user aborts or git command fails.

- [x] **Chunk 9.3: Webview Interactive Cards (`src/webview/App.tsx` & `src/extension/index.ts`)**
  - [x] Interactive `[📄 1 File...]` surgical rewind button on every snapshot in Virtual Timeline Tree.
  - [x] Auto-Split AI semantic partitioning card with 1-click execution in Branch Splitter view.
  - [x] Registered `gitwizard.rewindFile` and `gitwizard.autoSplit` in Command Palette and package.json.

---

### Sprint 10: Smart AI Conflict Resolver & Private GitHub Cloud Sync
* **Objective**: Eliminate merge conflict dread and deliver cross-device encrypted cloud backup.
* **Status**: Completed & Verified (113/113 unit tests passing across 20 test suites, gitwizard-2.0.0.vsix packaged)
* **Milestone Version**: `v2.0.0` (GitWizard Pro Commercial Launch)

#### Chunks & Trackable To-Dos:
- [x] **Chunk 10.1: Smart 3-Way AI Conflict Resolver (`src/pro/conflict-resolver.ts`)**
  - [x] Extract `BASE` common ancestor, `OURS` (local changes), and `THEIRS` (incoming changes) from Git index stages (:1, :2, :3).
  - [x] Feed all 3 representations to LLM with semantic resolution prompt with deterministic heuristic fallback.
  - [x] Verify generated code has 0 conflict markers and passes delimiter/syntax validation.
  - [x] Present visual resolution preview in Webview with rationale and 1-click staging.
  - [x] **Extensive Testing Suite (`test/pro/conflict-resolver.test.ts`)**:
    - [x] `clean-repo-no-conflict`: Detects clean repo with zero conflicts.
    - [x] `stage-extraction`: Analyzes real git merge conflict and extracts stages 1, 2, and 3.
    - [x] `ai-synthesis`: Synthesizes conflict resolution via mocked AI service.
    - [x] `imports-union-fallback`: Merges disjoint imports from both branches into single clean import block on LLM fallback.
    - [x] `syntax-validation`: Catches lingering markers or unbalanced braces.
    - [x] `apply-and-snapshot`: Applies resolution, stages file, and captures safety snapshot beforehand.
    - [x] `pro-license-guard`: Enforces Pro license check.

- [x] **Chunk 10.2: Private GitHub Cloud Sync Bridge (`src/pro/cloud-sync.ts`)**
  - [x] Create zero-COGS cloud backup by pushing client-side AES-256-GCM encrypted git bundles to a private hidden ref (`refs/gitwizard/cloud-sync`) on the user's existing GitHub repo.
  - [x] Sync snapshot metadata JSON across linked developer machines with scrypt key derivation.
  - [x] **Extensive Testing Suite (`test/pro/cloud-sync.test.ts`)**:
    - [x] `encrypt-and-decrypt`: Roundtrips AES-256-GCM encrypted payload cleanly.
    - [x] `tamper-detection`: Rejects corrupted ciphertext, invalid magic header, and bad passphrases.
    - [x] `create-and-restore-bundle`: Unpacks snapshots into fresh mock repository and verifies metadata and ref integrity.
    - [x] `remote-validation`: Rejects push when remote origin is missing with clear user guidance.
    - [x] `pro-license-guard`: Enforces Pro license check on cloud push and pull.

- [x] **Chunk 10.3: Webview 3-Way Visual Resolution Card (`src/webview/App.tsx`)**
  - [x] Prominent `⚔️ Merge Conflict Active` alert banner with 1-click `[✨ Auto-Resolve with AI]`.
  - [x] Side-by-side / code preview modal with synthesis rationale and `[✅ Accept Resolution & Stage File]`.
  - [x] Private GitHub Cloud Sync card in Virtual Timeline Tree with `[☁️ Sync / Backup to Remote]`.

- [x] **Chunk 10.4: v2.0.0 Packaging & Marketplace Readiness**
  - [x] Version bumped to `2.0.0` in `package.json`.
  - [x] Packaged `gitwizard-2.0.0.vsix` with zero warnings (1.24 MB).

---

## 🎨 Sprint 11: The Vibe-First UX Transformation (Humanizing Git for Noobs)

> **Objective**: Eliminate every barrier in info, knowledge, and experience preventing non-technical vibe coders from safely using Git.  
> **Reference Specs**: Living Product Designer Case Study in [docs/CASE_STUDY_PRODUCT_DESIGN.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/GitWizard/docs/CASE_STUDY_PRODUCT_DESIGN.md).

---

### Detailed Sprint 11 Phased Backlog:

#### Phase 1: Zero-Friction Onboarding & Untracked State Airbag
- [x] **Chunk 11.1: Uninitialized Repository Detector (`src/engine/git-client.ts` & `src/extension/index.ts`)**
  - [x] Implement `isRepo()` check in `GitClient` without throwing unhandled exceptions.
  - [x] Update `broadcastStatus()` to safely return `isRepo: false` when folder lacks `.git`.
  - [x] Add welcoming Webview Onboarding Card: "🪄 GitWizard Safe Mode is Ready: Turn on Safe Mode to get automatic time travel and safety backups" with `[✨ Enable Safe Mode (1-Click Init)]`.
  - [x] Wire 1-click `INIT_REPO` message handler to execute `git init` and create initial baseline snapshot.
- [x] **Chunk 11.2: Git Identity Self-Healing Modal (`src/wizards/essentials.ts` & `src/extension/index.ts`)**
  - [x] Detect missing `user.name` / `user.email` before or during `safeCommit()`.
  - [x] Surface gentle in-app modal in Webview asking for Display Name and Email instead of throwing `fatal: empty ident name (code 128)`.
  - [x] Save identity locally (`git config user.name "..."`, `git config user.email "..."`) and complete commit seamlessly.
- [x] **Chunk 11.3: Phase 1 Unit Test Coverage (`test/wizards/onboarding.test.ts`)**
  - [x] Test uninitialized directory status reporting.
  - [x] Test 1-click `git init` initialization transaction with initial snapshot capture.
  - [x] Test identity interception and auto-configuration on fresh Git environments (5 passing tests).

#### Phase 2: In-App Ergonomics & Settings De-Jargonization
- [x] **Chunk 11.4: In-Sidebar ⚙️ Settings Modal (`src/webview/App.tsx` & `src/extension/index.ts`)**
  - [x] Add ⚙️ settings icon button to the sidebar header next to `🧙 GITWIZARD`.
  - [x] Build in-sidebar modal for AI Provider selection (Gemini, OpenAI, Ollama), API key input, and Ollama URL configuration.
  - [x] Add live API key connection test button (`[🔌 Test Connection]`).
  - [x] Eliminate all prompts telling users to run "Command Palette (`Ctrl+Shift+P`)" commands.
- [x] **Chunk 11.5: Humanized Timeline & Reflog De-Jargonization (`src/wizards/undo.ts` & `src/webview/App.tsx`)**
  - [x] Replace cryptic `HEAD@{0}`, `HEAD@{1}` with relative human timestamps (`Just now`, `5 mins ago`, `Yesterday`).
  - [x] Translate Git action codes into human creator phrases (`Saved 3 files`, `Created new draft branch`, `Switched to feature/auth`).
- [x] **Chunk 11.6: Reassuring Co-Pilot Messaging for Secret Radar & Branch Guard**
  - [x] Rewrite Secret Radar alert from "Security Breach/Blocked" into reassuring co-pilot guidance (`🔒 Private API Key Protected`).
  - [x] Clarify Branch Guard to explain why protecting Live/Production (`main`) keeps the website from breaking (`🛡️ Live Website Protection`).

#### Phase 3: Visual Safety, Smart Splitter & Diff Previews
- [x] **Chunk 11.7: Semantic Categorizer Badges for File Splitter (`src/webview/App.tsx`)**
  - [x] Group dirty files into intuitive visual buckets: 🎨 `UI / Components`, ⚙️ `Backend / API`, 📄 `Config / Assets`.
  - [x] Add "Select All UI" and "Select All Backend" 1-click filters in Tab 3 (`✂️ Split`).
- [x] **Chunk 11.8: Visual Consequence Preview on Rewind (`src/webview/App.tsx`)**
  - [x] Show file count and list of affected files before snapshot restoration.
  - [x] Reassure user with visible guarantee: "🛡️ A safety backup of your current screen is automatically captured before rewinding."

#### Phase 4: Remote Sync & GitHub Onboarding Guard
- [x] **Chunk 11.9: Guided GitHub Connect Assistant for Safe Push (`src/wizards/essentials.ts` & `src/webview/App.tsx`)**
  - [x] Check if remote `origin` exists before attempting `safePush()`.
  - [x] If unlinked, suppress raw error toast and show guided modal: "☁️ Connect to GitHub (Link your repository URL to sync)".
- [x] **Chunk 11.10: Standalone Repo Split Graceful Fallback (`src/wizards/publish.ts`)**
  - [x] Check for `gh` CLI presence before invoking child process.
  - [x] If missing, provide instant browser link fallback to GitHub "New Repository" page with pre-filled repo name instead of throwing `spawn gh ENOENT`.

#### Phase 5: Marketplace Copy, Jargon-Free README & Visuals
- [x] **Chunk 11.11: Marketplace Discovery & Categorization (`package.json`)**
  - [x] Update categories to `["AI", "SCM Providers", "Education"]`.
  - [x] Add keywords: `cursor`, `vibe-coding`, `copilot`, `antigravity`, `time-machine`, `undo`, `git-safety`, `backup`, `noob`.
- [x] **Chunk 11.12: Jargon-Free README Overhaul (`README.md`)**
  - [x] Strip out references to DAG topologies, Zero-COGS, stage :1/:2/:3, and VSIX installation.
  - [x] Insert Value Comparison Table (Traditional Git vs GitWizard).
  - [x] Include animated walkthrough GIF placeholders and clear benefit-first copy.
- [x] **Chunk 11.13: Case Study Milestone Verification (`docs/CASE_STUDY_PRODUCT_DESIGN.md`)**
  - [x] Update all 5 phase status badges and live metrics upon completion.
- [x] **Chunk 11.14: Interactive Vibe Coder Playbook & Micro-Coaching (`src/wizards/playbook.ts` & `src/webview/App.tsx`)**
  - [x] Implement dedicated `🧭 Playbook` tab with 6 visual scenario recipes covering repository initiation to merge conflicts.
  - [x] Add 1-click interactive deep links from recipes to target tabs and features.
  - [x] Embed subtle `💡 When to use` micro-coaching chips at the top of Everyday, Rewind, Split, and Repo tabs.
  - [x] Add automated test coverage in `test/wizards/playbook.test.ts` (142/142 tests passing across all suites).

- [x] **Chunk 11.15: Instant Quick Snapshot & Native Notification System (`src/webview/App.tsx` & `src/extension/index.ts`)**
  - [x] Replace blocking webview `window.prompt()` with instant 1-click `Quick Snapshot (HH:MM)` capture.
  - [x] Add real-time visual feedback button state (`⏳ Capturing Snapshot...` → `✅ Quick Snapshot (HH:MM)`).
  - [x] Replace browser `window.alert()` calls with native VS Code toast messages (`SHOW_WARNING` & `SHOW_ERROR`).
  - [x] Add automated test coverage in `test/wizards/checkpoint.test.ts` (143/143 tests passing across 25 suites).

---

## 🚀 Sprint 12: Visual Diff Inspector (P7) & 1-Click PR Creator

> **Objective**: Enable visual side-by-side snapshot inspection using VS Code's native diff editor, and provide a 1-click automated GitHub Pull Request creator with AI summaries.  
> **Reference Specs**: Pro Feature P7 in [docs/PRO_SPECIFICATION.md](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/GitWizard/docs/PRO_SPECIFICATION.md).

---

### Sprint 12 Task Checklist:

- [x] **Chunk 12.1: Virtual Snapshot Document Provider & Plumbed Diff Engine (`src/engine/snapshot.ts` & `src/extension/index.ts`)**
  - [x] Add `getFileContent(snapshotId: string, filePath: string)` to `SnapshotManager` reading content from snapshot commit ref via `git show`.
  - [x] Register `vscode.workspace.registerTextDocumentContentProvider('gitwizard-snapshot', ...)` in `src/extension/index.ts`.
  - [x] Implement `OPEN_SNAPSHOT_DIFF` handler launching `vscode.diff` between virtual snapshot buffer and current file.
- [x] **Chunk 12.2: 1-Click GitHub Pull Request Wizard (`src/wizards/ai-commit.ts` & `src/wizards/pr.ts`)**
  - [x] Implement `createPullRequest()` handling branch push, `gh pr create` invocation with automated fallback to GitHub web compare URL.
  - [x] Parse remote `origin` into owner/repo format for web fallback.
- [x] **Chunk 12.3: Webview UI Integration (`src/webview/App.tsx`)**
  - [x] Add `[🔍 View Diff]` buttons on affected files in the Checkpoint Rewind preview modal.
  - [x] Add `[🔍 Preview Diff]` in the Single-File Rewind modal.
  - [x] Add `[🚀 Create PR on GitHub]` card and trigger in Tab 1 (Everyday Deck) and Tab 3 (Split Deck).
- [x] **Chunk 12.4: Comprehensive Unit & Integration Test Suite**
  - [x] Test `getFileContent` in `test/engine/snapshot.test.ts` (existing and non-existing files).
  - [x] Test PR creation logic and URL parsing in `test/wizards/pr.test.ts` (8/8 tests passing).
- [x] **Chunk 12.5: Verification Gate**
  - [x] Typecheck passing (`npm run compile`).
  - [x] All automated tests passing (`npm test` - 152/152 tests across 26 suites).
