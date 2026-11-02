# Changelog

All notable changes to **GitWizard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-11-02

### Added
- **Interactive Vibe Coder Playbook**: Dedicated `🧭 Playbook` tab with 6 visual scenario recipes covering repository initiation, AI prompt milestones, hallucinations, multi-file splitting, cloud backup, and conflict resolution.
- **Contextual Micro-Coaching Chips**: Embedded `💡 When to use` guidance banners at the top of Everyday, Rewind, Split, and Repo tabs with deep linking into Playbook recipes.
- **Instant Quick Snapshot**: Replaced modal `prompt()` with 1-click `📸 Quick Snapshot (HH:MM)` capture and animated in-button feedback state machine (`⏳ Capturing Snapshot...` → `✅ Saved HH:MM`).
- **Native Notification System**: Replaced webview `alert()` popups with non-intrusive native VS Code warning toasts (`SHOW_WARNING`).
- **5-Phase Vibe Coder UX Transformation**:
  - Phase 1: 1-Click Safe Mode onboarding hero card for untracked folders; self-healing Git author identity airbag for missing `user.name` / `user.email`.
  - Phase 2: In-sidebar ⚙️ Settings modal with live AI connection tester (`[🔌 Test Connection]`); humanized relative timestamps (`Just now`, `5 mins ago`) replacing `HEAD@{n}`.
  - Phase 3: Semantic categorizer badges (`🎨 UI`, `⚙️ API/Backend`, `📄 Config`, `📝 Docs`) and 1-click `[🎨 All UI]` filters; visual consequence preview before rewind with safety backup guarantee.
  - Phase 4: Guided GitHub cloud sync assistant preventing push errors on missing `origin`; graceful `gh` CLI fallback with pre-filled web repository link.
  - Phase 5: Flesch-Kincaid Grade 7.6 plain-English marketplace rewrite with side-by-side Git CLI vs. GitWizard comparison table.

### Changed
- **Packaging & Bundle Optimization**: Production esbuild bundling with code minification, shrinking VSIX package size significantly.
- **Hardened .vscodeignore**: Excluded CI workflows and internal agent documentation from extension distribution packages.

---

## [2.0.0] - 2026-11-01

### Added
- **GitWizard Pro Superpowers**:
  - **Cryptographic Offline Licensing**: HMAC-SHA256 / Ed25519 lifetime license validation with 14-day zero-card trial.
  - **AI Semantic Commit & PR Drafter**: Multi-provider support (Gemini, OpenAI, local Ollama) with diff pruning and conventional commit formatting.
  - **Pre-Flight Secret Radar**: Sub-25ms regex catalog and Shannon entropy detector for 15+ API key types.
  - **1-Click Secret Remediation**: Moves exposed API keys from code to `.env` and secures `.gitignore`.
  - **Production Branch Guard**: Intercepts direct commits on `main` and relocates changes to feature branches in 1 click.
  - **Surgical Single-File Rewind**: Reverts single damaged files from snapshots while keeping other dirty files intact.
  - **AI Semantic Multi-Branch Splitter**: Clusters multi-file AI prompt diffs into distinct PR branches.
  - **3-Way AI Conflict Resolver**: Synthesizes BASE/OURS/THEIRS merge conflicts into clean code without conflict markers.
  - **Private GitHub Cloud Sync Bridge**: Client-side AES-256-GCM encrypted snapshot sync to `refs/gitwizard/cloud-sync`.

---

## [1.0.0] - 2026-10-23

### Added
- **AutoCheckpointController Test Suite**: 9 comprehensive automated tests verifying flight recorder debounce scheduling, concurrent capture locks, rolling window pruning, and duplicate tree SHA skipping.
- **Shadow Index Isolation**: Working tree snapshots now execute in an isolated temporary Git index file (`GIT_INDEX_FILE`), preserving 100% of the user's staged vs. unstaged status during auto-checkpoints.
- **Stash-Pop Conflict Recovery**: Added end-to-end recovery tests when uncommitted local files conflict with pulled remote changes during `SafeSync`.
- **Reflog Time Machine Edge Cases**: Verified arbitrary reflog selector rollback (`HEAD@{2}`, etc.), safe rollbacks on invalid selectors, and parsing of checkout, amend, reset, and merge actions.
- **Repo & Branch Splitting Validation**: Added validation tests for empty groups, missing files, branch name collisions, and temporary remote cleanup on push errors.
- **Command Palette Registrations**: Fully exposed `gitwizard.undoLast`, `gitwizard.splitToNewRepo`, `gitwizard.pushMain`, and `gitwizard.splitChanges` in `contributes.commands`.
- **OSS Documentation**: Added `CONTRIBUTING.md` and detailed `CHANGELOG.md`.

### Fixed
- Fixed bug in `AutoCheckpointController` where duplicate tree SHA detection compared index states before snapshotting rather than working tree content.
- Fixed `SnapshotManager.createSnapshot` to prevent unintended staging into the active `.git/index`.
- Fixed `stashCreate` support for dirty working directory evaluations.

---

## [0.3.0] - 2026-10-22

### Added
- Repository Promotion Wizard (`RepoSplitterWizard`): Split an experimental feature branch into an independent repository with GitHub CLI (`gh`) integration.
- Daily Essentials Quick Push/Pull: Push and pull workflows with safe snapshot checkpoints.

---

## [0.2.0] - 2026-10-20

### Added
- Daily Essentials UI Deck in Webview (Save, Push, Pull, Branch, Uncommit).
- Passive Auto-Checkpoint Controller ("Flight Recorder") triggered on editor save.
- Virtual Timeline Tree with one-click instant state rewind.
- Plain-English Action Preview and Confirmation modals.

---

## [0.1.0] - 2026-10-15

### Added
- Core Git safety engine (`GitClient`, `SnapshotManager`, `TransactionRunner`).
- Checkpoint Wizard for manual shadow snapshots.
- Branch Splitter Wizard for partitioning multi-file diffs into logical branches.
- Safe Sync Wizard with automatic abort and rollback on merge conflicts.
- VS Code / Antigravity Webview sidebar interface.
