# 🧙‍♂️ GitWizard — Safe Git for Vibe Coders

> **Zero data loss. Zero cryptic Git errors. Full speed AI development.**

**GitWizard** is an intent-based Git safety and orchestration extension for **VS Code**, **Cursor**, and **Antigravity**. It bridges the gap between conversational AI development ("vibe coding") and Git by turning complex Git operations into safe, intent-driven visual workflows.

---

## ⚡ Why GitWizard?

Vibe coders move fast, iterate conversationally, and ask AI models to generate code across dozens of files at once. But Git was designed for clean DAG topologies and manual staging.

When things go wrong—such as messy working trees, accidental merge conflicts, or catastrophic `git reset --hard` mistakes—traditional Git strands you in a broken state.

**GitWizard gives you an unbreakable safety net:**
* **Never lose uncommitted work**: Automatic shadow checkpoints before every transaction.
* **Instant conflict abort**: If remote sync conflicts, GitWizard aborts immediately and restores your workspace to the exact millisecond before the command ran.
* **Human-friendly undo**: Reflog events translated into plain English with 1-click rollback.

---

## 🌟 Core Features

### 1. ⚡ Daily Essentials (The Calm Git Deck)
* **Save My Work (Commit)**: 1-click stage and commit with clear English descriptions.
* **Send & Update (Push & Safe Pull)**: 1-click push with upstream tracking, plus conflict-shielded safe pulling that auto-aborts and restores if remote changes collide.
* **Branch Management**: Quick branch switcher and one-click new branch creator.
* **Undo Last Commit (Uncommit)**: Soft undo moving `HEAD` back while keeping 100% of your modified code right in your editor.

### 2. ⏳ Virtual Timeline Tree & Passive Flight Recorder
* **Zero-Effort Auto-Saves**: Passively records debounced shadow snapshots before AI prompt sessions mutate code.
* **Retrospective Time Machine**: Chronological visual tree of auto-saves, manual checkpoints, and commits.
* **1-Click Rewind**: Instant restoration with automatic pre-restore safety backups.

### 3. 🛡️ Plain-English Action Approvals
* Before any non-trivial operation (Split, Rewind, Pull, Uncommit), GitWizard shows a calm preview card explaining what will happen in plain English and guarantees zero data loss.

### 4. ✂️ Branch & Commit Splitter
* Did your AI pair programmer just touch 10+ files across your backend and UI?
* Select which files go to Branch A and Branch B with a visual selector.
* Sequentially commits and creates clean, PR-ready branches.

---

## 🚀 Installation & Usage

### Installing in VS Code / Cursor / Antigravity
1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Click the `...` menu in the top-right of the Extensions panel.
3. Select **Install from VSIX...** and choose `gitwizard-0.3.0.vsix`.
4. Click the **GitWizard** wand icon (`$(wand)`) in the Activity Bar or check the Status Bar!

---

## 🛠️ Development & Testing

```bash
# Run isolated engine & wizard unit tests
npm test

# Build extension and webview bundles
npm run build

# Strict TypeScript typechecking
npm run compile

# Package VSIX extension
npm run package
```

---

## 📜 License
MIT © Dr. OpenSource
