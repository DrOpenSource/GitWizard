# Changelog

All notable changes to **GitWizard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
