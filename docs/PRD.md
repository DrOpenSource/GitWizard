# GitWizard — Product Requirements Document (PRD)

## 1. Executive Summary
**GitWizard** is an intent-based Git safety and orchestration extension for VS Code, Cursor, and Antigravity. It empowers "vibe coders"—developers who rapidly generate code using AI prompts—to safely iterate without fear of corrupted repositories, lost code, or cryptic merge conflicts.

---

## 2. Problem Statement & User Pain Points
1. **The "Messy Workspace" Trap**: AI pair programmers frequently modify 10+ files across different concerns at once. Vibe coders don't know how to cleanly split these changes into semantic commits.
2. **Accidental Clobbering**: Destructive Git commands (`reset --hard`, `checkout -f`, `clean -fd`, bad rebases) cause irreversible data loss.
3. **Mid-Operation Paralysis**: When a rebase or merge fails, Git enters a detached or conflict state (`MERGING`, `REBASE 1/3`). Vibe coders are trapped and don't know how to safely back out.
4. **Git GUIs Don't Speak "Intent"**: Existing tools (GitKraken, VS Code Source Control) visualize Git primitives (index, HEAD, trees), requiring the user to already understand Git topology.

---

## 3. Target Persona
* **The "Vibe Coder" / AI-First Developer**:
  * Values momentum and velocity over learning Git internals.
  * Relies heavily on Cursor, Antigravity, Claude Code, or Copilot.
  * Needs a safety net ("Undo", "Checkpoint", "Split") that works reliably behind the scenes.

---

## 4. MVP Feature Scope

### Core Capabilities
| Feature | User Intent | Underlying Orchestration |
| :--- | :--- | :--- |
| **1. Daily Essentials (The Calm Deck)** | *"I just want to commit, push, pull, uncommit, and branch without fear"* | Plain-English 1-click primitives (`safeCommit`, `safePush`, `safePull`, `safeUncommit`, `createBranch`). Always backed by automatic safety snapshots. |
| **2. Auto-Checkpoint & Flight Recorder** | *"I'm vibe coding with AI; save checkpoints automatically before AI edits"* | Passive background debounced shadow snapshots (`refs/gitwizard/snapshots/auto-*`). Zero effort required from user. |
| **3. Virtual Timeline Tree** | *"Where am I and how do I rewind to before a bad prompt?"* | Interactive retrospective tree combining commits, manual saves, and auto-saves. 1-click rewind with plain-English preview and zero data loss. |
| **4. Visual File Organizer (Branch Splitter)** | *"AI modified 15 files; I want a clean separation between features"* | Visual categorizer. Sequentially branches, commits selected files, stashes remainders, and cleans state. |
| **5. Plain-English Action Approvals** | *"Tell me what will happen before touching my Git repo"* | Modal explaining actions, affected files, and rollback safety guarantee before execution. |

---

## 5. Explicit Non-Goals (Out of Scope for V1)
* **Not a Full Git GUI Replacement**: We are NOT building another GitKraken with complex graph DAGs.
* **No Manual 3-Way Merge Tool**: GitWizard safely aborts conflicting merges/rebases back to the pre-transaction state rather than forcing a complex manual merge editor in V1.
* **No Remote Hosting Management**: We do not manage GitHub PR reviews or CI pipelines.

---

## 6. Success Metrics & Acceptance Criteria
* **Zero Data Loss**: In any simulated failure (process kill, non-zero git exit, dirty tree conflict), the repository must restore to 100% of its pre-transaction state.
* **Sub-Second Checkpointing**: Taking a snapshot must complete in <300ms using native Git plumbing (`git stash create`, `git write-tree`).
* **Vibe Coder Clarity**: 100% of actions provide plain-English previews before destructive operations, with zero technical Git jargon required for daily usage.
* **Extension Startup Overhead**: Extension activates in <50ms without blocking editor responsiveness.
