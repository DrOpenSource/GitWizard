# 🧙‍♂️ GitWizard Pro (v2.0.0) — Manual User Testing Guide & QA Runbook

> **Welcome to the GitWizard Pro v2.0 Test Suite.**  
> This guide is designed for developers and vibe coders to systematically test every single Pro and Free feature directly inside **VS Code**, **Cursor**, or **Antigravity**.

---

## 📋 Quick Feature Test Matrix

| # | Feature Under Test | Area in Extension | Key Trigger | Expected Result |
| :- | :--- | :--- | :--- | :--- |
| **1** | **AI Semantic Commit Message** | Tab 1: Everyday Deck | Click `[✨ AI Message]` | Generates conventional commit based on working tree diff |
| **2** | **Pre-Flight Secret Radar** | Commit Action | Commit code with fake API key | Blocks commit in <25ms with masked secret alert modal |
| **3** | **1-Click Secret Remediation** | Secret Radar Modal | Click `[🔒 Extract to .env]` | Extracts to `.env`, adds `.gitignore`, substitutes `process.env` |
| **4** | **Production Branch Guard** | Commit Action on `main` | Commit while on `main` | Intercepts commit; 1-click relocates changes to feature branch |
| **5** | **Surgical Single-File Rewind** | Tab 2: Rewind Tree | Click `[📄 1 File...]` on node | Reverts only the selected file; other dirty files remain untouched |
| **6** | **AI Multi-Branch Auto-Splitter** | Tab 3: Split Deck | Click `[✨ Auto-Split into PRs]` | Semantically groups modified files into 2 distinct PR branches |
| **7** | **Smart 3-Way AI Conflict Resolver** | Active Conflict State | Click `[✨ Auto-Resolve with AI]` | Merges BASE/OURS/THEIRS into clean code with 0 conflict markers |
| **8** | **Private GitHub Cloud Sync** | Tab 2: Rewind Tree | Click `[☁️ Sync / Backup]` | Pushes AES-256-GCM encrypted snapshot bundle to remote ref |
| **9** | **Offline License & Trial Engine** | Header Pro Badge | Click `⭐ PRO ACTIVE` badge | Offline HMAC verification, trial day counter, lifetime unlock |
| **10**| **Soft Undo (Uncommit)** | Tab 1: Everyday Deck | Click `↩️ Undo Last Commit` | Undoes commit container while keeping 100% of code in editor |

---

## 🛠️ Prerequisites & Initial Setup

1. **Install VSIX**: Ensure `gitwizard-2.0.0.vsix` is installed (`Ctrl+Shift+X` → `...` menu → `Install from VSIX...`).
2. **Open GitWizard**: Click the 🧙‍♂️ **GitWizard** wand icon in your Activity Bar.
3. **Verify Pro Status Badge**: The header should display either:
   - `✨ PRO TRIAL (14d left)` (automatic zero-card trial) OR
   - `⭐ PRO ACTIVE` (if lifetime key entered).
4. **Configure AI Provider** (Optional — defaults to Gemini free tier or local Ollama):
   - Press `Ctrl+Shift+P` → run `GitWizard Pro: Configure AI Provider & Key`.
   - Select **Google Gemini**, **OpenAI (`gpt-4o-mini`)**, or **Local Ollama**.

---

## 🧪 Detailed Test Scenarios

---

### Scenario 1: AI Semantic Commit Generator & PR Drafter
**Goal**: Verify that GitWizard analyzes working tree diffs and untracked files to produce meaningful conventional commits.

* **Step 1**: Make a small change to any file (or notice the newly created [`docs/USER_TESTING_GUIDE.md`](file:///c:/Users/user/Desktop/Dr_OpenSource/Projects/GitWizard/docs/USER_TESTING_GUIDE.md)).
* **Step 2**: Open the GitWizard sidebar → navigate to **Tab 1 (⚡ Everyday)**.
* **Step 3**: Notice the status card says `🟡 1 file dirty`.
* **Step 4**: Under **💾 Save Changes (Commit)**, click the purple **`[✨ AI Message]`** button.
* **✅ What to Expect**:
  - The button turns into `⏳ Reading changes...`.
  - Within 1–2 seconds, the textarea is filled with an accurate conventional commit message (e.g., `docs(qa): add manual user testing guide and QA runbook`).
  - You can edit the text before saving.
  - Clicking **`💾 Save My Work (Commit)`** commits the changes cleanly!

---

### Scenario 2: Pre-Flight Secret Radar (Instant Leak Shield)
**Goal**: Verify that accidental hardcoded secrets are caught in `< 25ms` before they reach Git history.

* **Step 1**: Open a scratch file (or edit an existing file like `src/test-secret.ts`).
* **Step 2**: Paste a realistic dummy secret token, for example:
  ```typescript
  const openaiKey = "sk-proj-9999888877776666555544443333222211110000aaaa";
  ```
* **Step 3**: In GitWizard sidebar, type a commit message like `test: add openai client` and click **`💾 Save My Work (Commit)`**.
* **✅ What to Expect**:
  - The commit is **immediately blocked**.
  - A red/amber **`🚨 Secret Radar Alert`** modal appears on screen.
  - The modal lists:
    - File path and line number
    - Detected rule name (`OpenAI API Key`)
    - Masked secret (`sk-pr****************00aaaa`)
  - Git history has **zero** record of this commit yet.

---

### Scenario 3: 1-Click Secret Remediation Engine
**Goal**: Verify that GitWizard automatically moves secrets from source code into `.env` and secures them with `.gitignore`.

* **Step 1**: With the **`🚨 Secret Radar Alert`** modal open from Scenario 2:
* **Step 2**: Click the green button: **`[🔒 Extract to .env & Add to .gitignore (1-Click)]`**.
* **✅ What to Expect**:
  - The modal closes.
  - Look at your code in the editor: the raw string `"sk-proj-..."` has been replaced with `process.env.OPENAI_API_KEY`!
  - Look at `.env` in the project root: contains `OPENAI_API_KEY="sk-proj-..."`.
  - Look at `.gitignore`: `.env` is listed so it will never be tracked or leaked to GitHub.
  - You can now safely click **`💾 Save My Work (Commit)`**!

---

### Scenario 4: Production Branch Guard (No Direct Commits on `main`)
**Goal**: Prevent vibe coders from accidentally committing experimental or broken code directly onto protected branches.

* **Step 1**: Make sure your active branch is `main` (or switch to `main` via the branch dropdown in Tab 1).
* **Step 2**: Modify any file in your project.
* **Step 3**: Try to commit by clicking **`💾 Save My Work (Commit)`**.
* **✅ What to Expect**:
  - The commit does **not** land on `main`.
  - A golden **`🛡️ Production Branch Guard`** modal pops up:
    > *"Direct commits on 'main' are guarded to prevent accidental production breakages."*
  - The modal proposes: **`[🌿 Create "feature/updates" Instead]`** (or a name derived from your changes).
  - Click **`[🌿 Create ... Instead]`**: GitWizard automatically creates the feature branch, moves your uncommitted work there, and leaves `main` 100% clean!
  - Power user override: Clicking *"Commit to main Anyway"* is still available if intentional.

---

### Scenario 5: Surgical Single-File Rewind (Per-File Time Machine)
**Goal**: Restore an individual corrupted file from a snapshot without rolling back other unrelated files.

* **Step 1**: Modify two different files, for example `fileA.ts` and `fileB.ts`.
* **Step 2**: In GitWizard top status card, click **`📸 Quick Snapshot`** (name it `baseline-save`).
* **Step 3**: Now make messy edits to both `fileA.ts` and `fileB.ts`.
* **Step 4**: Go to **Tab 2 (⏳ Rewind)**.
* **Step 5**: Find `baseline-save` in the timeline list. Notice there are two buttons: `[⏪ All]` and `[📄 1 File...]`.
* **Step 6**: Click **`[📄 1 File...]`**.
* **Step 7**: A modal appears asking which file to rewind. Click `fileA.ts` from the quick chips or type its path, and click **`⏮️ Rewind This File`**.
* **✅ What to Expect**:
  - Only `fileA.ts` reverts to the exact contents of `baseline-save`.
  - `fileB.ts` still has all your latest modifications intact in your editor!

---

### Scenario 6: Semantic AI Multi-Branch Auto-Splitter
**Goal**: Cleanly divide a massive 15-file AI prompt output into 2 logical, reviewable PR branches.

* **Step 1**: Ensure you have at least 2 modified files in different areas (e.g. `docs/README.md` and a file in `src/`).
* **Step 2**: Switch to **Tab 3 (✂️ Split)**.
* **Step 3**: Look at the top card: **`✨ AI Semantic Multi-Branch Auto-Split`**.
* **Step 4**: Click **`[✨ Auto-Split into PRs (1-Click)]`**.
* **✅ What to Expect**:
  - The button pulses `⏳ Analyzing file semantics...`.
  - AI groups the dirty files by architectural domain (e.g. `feature/docs` and `feature/core`).
  - Cards preview each group with proposed branch names, commit messages, and file lists.
  - Click **`[🚀 Execute AI Multi-Branch Split Now]`**: GitWizard executes atomic isolated staging and creates both branches with safety backups!

---

### Scenario 7: Smart 3-Way AI Conflict Resolver
**Goal**: Resolve merge conflicts automatically without dreading conflict markers.

* **Step 1**: If your repository ever enters a merge or rebase conflict (e.g. from git merge or pull):
* **Step 2**: The GitWizard top card instantly shows a red banner:
  > **`⚔️ 1 Merge Conflict Active`**  
  > *GitWizard can synthesize non-destructive code resolutions with 0 lost code.*
* **Step 3**: Click **`[✨ Auto-Resolve with AI (1-Click)]`**.
* **✅ What to Expect**:
  - GitWizard inspects Stage 1 (BASE), Stage 2 (OURS), and Stage 3 (THEIRS).
  - A preview modal pops up with:
    - Clean resolved code (verified: **0 conflict markers** remaining).
    - Synthesis rationale (e.g., *"Merged login parameter and preserved incoming billing API import"*).
  - Click **`[✅ Accept Resolution & Stage File]`**: The file is written to disk, staged with `git add`, and marked resolved!
  - Clicking **`[↩️ Abort Merge]`** aborts cleanly and restores your workspace safely.

---

### Scenario 8: Private GitHub Cloud Sync Bridge (Zero-COGS)
**Goal**: Back up your GitWizard snapshots cross-device via your existing GitHub remote with zero server costs.

* **Step 1**: Go to **Tab 2 (⏳ Rewind)**.
* **Step 2**: Scroll down to the blue **`☁️ Private GitHub Cloud Sync`** card.
* **Step 3**: Click **`[☁️ Sync / Backup to Remote]`**.
* **Step 4**: A modal allows entering an optional passphrase (or uses auto-derived key). Click **`[☁️ Push Encrypted Backup]`**.
* **✅ What to Expect**:
  - GitWizard packages all local snapshot refs and metadata.
  - Encrypts everything with client-side **AES-256-GCM**.
  - Pushes directly to hidden ref `refs/gitwizard/cloud-sync` on your git remote.
  - Zero external servers or databases are used; your code never leaves your own Git repository!

---

### Scenario 9: Soft Undo (Uncommit Without Code Loss)
**Goal**: Unwind an accidental commit while keeping 100% of your code modifications in your editor.

* **Step 1**: Commit any change via Tab 1.
* **Step 2**: Realize you forgot to add something or want to tweak the code.
* **Step 3**: In **Tab 1 (⚡ Everyday)**, click the bottom button:  
  **`↩️ Undo Last Commit (Keeps All Files Modified)`**.
* **Step 4**: Confirm the plain-English approval modal.
* **✅ What to Expect**:
  - The commit is undone (`HEAD` moves back 1 commit).
  - **100% of your code changes** remain in your working tree as modified files. Nothing is deleted!

---

### Scenario 10: Offline Cryptographic License Activation
**Goal**: Verify that Pro licenses activate completely offline with zero telemetry or pinging.

* **Step 1**: Click the `✨ PRO TRIAL` badge in the header.
* **Step 2**: The License Activation Modal opens.
* **Step 3**: You can generate a test key using node:
  ```bash
  node -e "const crypto=require('crypto'); const e='test@user.com'; const t=Date.now(); const s=crypto.createHmac('sha256','gitwizard-pro-lifetime-secret-salt-2026').update(Buffer.from(e).toString('base64url')+'.'+t).digest('hex'); console.log('GWPRO-LIFETIME.'+Buffer.from(e).toString('base64url')+'.'+t+'.'+s)"
  ```
* **Step 4**: Paste the key into the input and click **`Activate License`**.
* **✅ What to Expect**:
  - Header badge updates immediately to **`⭐ PRO ACTIVE`**.
  - Displays lifetime license holder email.
  - Zero network requests are made.

---

## 🐞 Reporting Bugs or Edge Cases

If you encounter any unexpected behavior during manual testing:
1. Check the GitWizard Output channel in VS Code: `View` → `Output` → select `GitWizard`.
2. Check Reflog history in Tab 2 to verify that safety snapshots were captured.
3. Every operation has an automated safety airbag: you can always click `[⏪ Rewind]` on any prior checkpoint!
