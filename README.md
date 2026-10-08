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

### 1. 🛡️ Instant Safety Checkpoint
* Capture a lightweight snapshot of your current working directory (including modified and untracked files) before prompting an AI agent.
* Uses dedicated Git plumbing (`refs/gitwizard/snapshots/*`) without polluting your commit history or moving `HEAD`.
* Restore anytime with a single click.

### 2. ✂️ Branch & Commit Splitter
* Did your AI pair programmer just touch 8 files across your backend and UI?
* Select which files go to Branch A and which go to Branch B.
* GitWizard executes an atomic transaction: stashing, creating branches, and committing files into clean, PR-ready branches.

### 3. 🔄 Safe Remote Sync
* Pull or rebase from upstream safely.
* If a merge conflict occurs, GitWizard **automatically aborts the merge** and restores your working tree to your safe pre-sync snapshot. You never get stuck in a detached HEAD or broken `MERGE_HEAD` state.

### 4. ⏪ Time Machine / Undo
* Translates cryptic Git reflog entries into readable cards:
  * *"Committed: 'Added auth route' "*
  * *"Switched branch from main to feature/ui"*
  * *"Merged branch dev"*
* 1-click rewind to `HEAD@{1}` with an automatic safety snapshot created before the rewind.

---

## 🚀 Installation & Usage

### Installing in VS Code / Cursor / Antigravity
1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Click the `...` menu in the top-right of the Extensions panel.
3. Select **Install from VSIX...** and choose `gitwizard-0.1.0.vsix`.
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
