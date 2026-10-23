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

## 🌟 Core Features (Free Tier)

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

## ⭐ GitWizard Pro ($49 One-Time Lifetime / $29 Early Bird)

GitWizard Pro is built on a **Zero-COGS, Bring-Your-Own-Key (BYOK)** architecture. Zero monthly subscriptions. Complete offline and local execution.

### 1. ✨ AI Semantic Commit Messages & PR Drafter
* Generates conventional commit messages directly from your working tree diffs and untracked files with 1-click.
* Provider-agnostic: Works with **Google Gemini**, **OpenAI (`gpt-4o-mini`)**, or **100% local Ollama**.

### 2. 🔒 Pre-Flight Secret Radar & 1-Click Remediation
* Scans all diffs and untracked files in **< 25ms** before every commit.
* Catches OpenAI, Stripe, AWS, Anthropic, Gemini, Slack tokens, and database URLs.
* **1-Click Remediation**: Automatically extracts plain secrets into `.env`, adds `.env` to `.gitignore`, and substitutes with `process.env.VARIABLE_NAME`.

### 3. 🛡️ Production Branch Guard
* Intercepts accidental direct commits to `main`, `master`, `production`, or `release/*`.
* Provides 1-click feature branch relocation (`[🛡️ Create Feature Branch Instead]`).

### 4. 📄 Surgical Single-File Rewind
* Restore individual files from any snapshot with 1-click (`[📄 1 File...]`).
* Leaves all your other modified and untracked files 100% untouched.

### 5. ✂️ AI Multi-Branch Auto-Splitter
* Analyzes semantic dependencies and import structures across 20+ modified files.
* Automatically partitions files into 2–3 logical PR branches with proposed commit messages.

### 6. ⚔️ Smart 3-Way AI Conflict Resolver
* Inspects Git conflict stages (`BASE :1`, `OURS :2`, `THEIRS :3`).
* Synthesizes non-destructive resolutions without losing any logic, imports, or bug fixes.
* Verifies zero remaining conflict markers with an automated rollback airbag.

### 7. ☁️ Private GitHub Cloud Sync Bridge
* Zero third-party cloud backends.
* Creates client-side **AES-256-GCM encrypted** snapshot bundles and syncs them directly to `refs/gitwizard/cloud-sync` on your existing GitHub repository.

---

## ⚙️ AI Provider Setup (BYOK)

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
`GitWizard Pro: Configure AI Provider & Key`

Select your preferred provider:
1. **Google Gemini**: Free tier API keys available at [ai.google.dev](https://ai.google.dev).
2. **OpenAI**: Use your OpenAI API key with `gpt-4o-mini`.
3. **Local Ollama**: 100% offline, zero keys required (`http://localhost:11434`).

---

## 🚀 Installation & Usage

### Installing in VS Code / Cursor / Antigravity
1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Click the `...` menu in the top-right of the Extensions panel.
3. Select **Install from VSIX...** and choose `gitwizard-2.0.0.vsix`.
4. Click the **GitWizard** wand icon (`$(wand)`) in the Activity Bar or check the Status Bar!
5. Enjoy the 14-day free Pro trial or activate your lifetime key in the sidebar.

---

## 🛠️ Development & Testing

```bash
# Run entire 20-suite test battery (113 passing tests)
npm test

# Build extension and webview bundles
npm run build

# Strict TypeScript typechecking
npm run compile

# Package VSIX extension
npx vsce package --no-dependencies
```

---

## 📜 License
MIT © Dr. OpenSource
