---
name: git-safety
description: >-
  Use this skill when developing GitWizard engine components or executing Git operations that must guarantee zero data loss, atomic rollbacks, and safe working tree handling.
---

# Git Safety & Transaction Engine Patterns

This skill guides the design and implementation of the GitWizard safety engine.

---

## 1. Zero-Data-Loss Rule

Traditional Git commands (`git reset --hard`, `git checkout -f`, `git clean -fd`) permanently delete untracked or uncommitted work.
GitWizard must **never** execute any mutating command without first creating a shadow snapshot.

---

## 2. Low-Overhead Snapshot Mechanism

Instead of making full directory copies (which is slow and memory-intensive for large repos), GitWizard uses Git's internal plumbing:

### Creating a Snapshot Ref
1. Write the current index to a tree:
   `git write-tree`
2. Create a temporary commit object capturing both staged + unstaged files without moving `HEAD`:
   `git stash create "gitwizard-snapshot-<id>"`
3. Store the resulting commit SHA in a dedicated namespace:
   `git update-ref refs/gitwizard/snapshots/<id> <commit-sha>`
4. Untracked files handling:
   Run `git ls-files --others --exclude-standard` to index untracked files into the snapshot or save them to a localized metadata store.

### Restoring a Snapshot
If any step in an orchestrated cascade fails (e.g., merge conflict or rejected pull):
1. Abort in-progress Git operation (`git merge --abort`, `git rebase --abort`).
2. Restore working directory from snapshot ref:
   `git reset --hard <snapshot-commit-sha>`
3. Notify the user with exact reason for rollback and preserve their original state intact.

---

## 3. Transaction Execution Lifecycle

All wizard actions must run through a formal `TransactionRunner`:

```typescript
interface GitStep {
  name: string;
  run(): Promise<void>;
  rollback(): Promise<void>;
}

class GitTransaction {
  async execute(steps: GitStep[]): Promise<TransactionResult> {
    const snapshotId = await snapshotManager.createSnapshot("pre-transaction");
    try {
      for (const step of steps) {
        await step.run();
      }
      return { success: true, snapshotId };
    } catch (error) {
      await snapshotManager.restoreSnapshot(snapshotId);
      return { success: false, error, rolledBack: true };
    }
  }
}
```
