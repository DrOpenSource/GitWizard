/**
 * DailyEssentialsWizard: Plain-English everyday Git primitives for vibe coders.
 * (Commit, Push, Pull, Uncommit, Branch) backed by zero-data-loss snapshots.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';

export interface EssentialResult {
  success: boolean;
  message: string;
  detail?: string;
  rolledBack?: boolean;
}

export class DailyEssentialsWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;

  constructor(git: GitClient, snapshotManager: SnapshotManager) {
    this.git = git;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Safe Commit: Stages all changes and commits with a user message.
   * Takes a safety snapshot beforehand.
   */
  async safeCommit(commitMessage: string): Promise<EssentialResult> {
    const trimmed = commitMessage.trim();
    if (!trimmed) {
      throw new Error('Please enter a commit message describing your changes.');
    }

    const status = await this.git.getStatus();
    const dirtyCount = status.modified.length + status.staged.length + status.untracked.length;
    if (dirtyCount === 0) {
      return {
        success: false,
        message: 'No changes to commit. Your workspace is completely clean!'
      };
    }

    // Safety snapshot
    await this.snapshotManager.createSnapshot('pre-commit-safety');

    // Stage all
    await this.git.exec(['add', '-A']);

    // Commit
    const res = await this.git.exec(['commit', '-m', trimmed]);
    const headRes = await this.git.exec(['rev-parse', '--short', 'HEAD'], { allowFailure: true });
    const shortSha = headRes.stdout ? headRes.stdout.trim() : 'HEAD';

    return {
      success: true,
      message: `Safely saved commit [${shortSha}]: "${trimmed}"`,
      detail: res.stdout
    };
  }

  /**
   * Safe Uncommit: Safely undoes the last commit without losing ANY working tree files (soft reset).
   */
  async safeUncommit(): Promise<EssentialResult> {
    const headRes = await this.git.exec(['rev-parse', 'HEAD~1'], { allowFailure: true });
    if (headRes.exitCode !== 0) {
      throw new Error('Cannot undo commit: Repository only has 1 commit or HEAD has no parent.');
    }

    // Safety snapshot
    await this.snapshotManager.createSnapshot('pre-uncommit-safety');

    // Soft reset moves HEAD back by 1 without modifying working tree or deleting files
    await this.git.exec(['reset', '--soft', 'HEAD~1']);

    return {
      success: true,
      message: 'Uncommitted last commit! All your modified files were safely preserved.'
    };
  }

  /**
   * Safe Push: Sends current branch to remote origin with automatic upstream tracking.
   */
  async safePush(remote: string = 'origin'): Promise<EssentialResult> {
    const branch = await this.git.getCurrentBranch();
    if (branch === 'HEAD (detached)') {
      throw new Error('Cannot push in detached HEAD state. Please switch to a branch first.');
    }

    // Attempt push with upstream tracking
    const res = await this.git.exec(['push', '-u', remote, branch], { allowFailure: true, timeoutMs: 30000 });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Push to ${remote}/${branch} failed: ${res.stderr || res.stdout}`
      };
    }

    return {
      success: true,
      message: `Pushed '${branch}' successfully to ${remote}!`,
      detail: res.stdout || res.stderr
    };
  }

  /**
   * Safe Pull: Fetches and integrates updates from remote, aborting and restoring if conflicts occur.
   */
  async safePull(remote: string = 'origin'): Promise<EssentialResult> {
    const branch = await this.git.getCurrentBranch();
    if (branch === 'HEAD (detached)') {
      throw new Error('Cannot pull in detached HEAD state.');
    }

    // 1. Take safety snapshot of current state
    const prePullSnap = await this.snapshotManager.createSnapshot('pre-pull-safety');

    // 2. Try pull
    const res = await this.git.exec(['pull', remote, branch], { allowFailure: true, timeoutMs: 30000 });
    if (res.exitCode !== 0) {
      // Conflict or failure detected -> cleanly abort and restore
      await this.git.abortInProgress();
      await this.snapshotManager.restoreSnapshot(prePullSnap.id);

      return {
        success: false,
        rolledBack: true,
        message: `Remote pull caused conflicts or failed. Workspace was safely restored to your exact state before pull!`,
        detail: res.stderr || res.stdout
      };
    }

    return {
      success: true,
      message: `Successfully updated '${branch}' with latest changes from ${remote}!`,
      detail: res.stdout
    };
  }

  /**
   * Create & Switch Branch: Creates a new feature branch and switches to it safely.
   */
  async createBranch(branchName: string): Promise<EssentialResult> {
    const cleanName = branchName.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\/]/g, '');
    if (!cleanName) {
      throw new Error('Please enter a valid branch name.');
    }

    await this.snapshotManager.createSnapshot('pre-branch-safety');

    const res = await this.git.exec(['checkout', '-b', cleanName], { allowFailure: true });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to create branch '${cleanName}': ${res.stderr || res.stdout}`
      };
    }

    return {
      success: true,
      message: `Created and switched to new branch '${cleanName}'!`
    };
  }

  /**
   * Switch Branch safely.
   */
  async switchBranch(branchName: string): Promise<EssentialResult> {
    const cleanName = branchName.trim();
    if (!cleanName) {
      throw new Error('Please enter a branch name to switch to.');
    }

    await this.snapshotManager.createSnapshot('pre-switch-safety');

    const res = await this.git.exec(['checkout', cleanName], { allowFailure: true });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to switch to '${cleanName}': ${res.stderr || res.stdout}`
      };
    }

    return {
      success: true,
      message: `Switched to branch '${cleanName}'!`
    };
  }
}
