/**
 * BranchSplitterWizard: Allows vibe coders to take a messy working tree
 * and cleanly partition changes into separate branches and semantic commits.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import { TransactionRunner } from '../engine/transaction';

export interface SplitGroup {
  branchName: string;
  commitMessage: string;
  files: string[];
}

export interface SplitRequest {
  baseBranch?: string;
  groups: SplitGroup[];
}

export interface SplitResult {
  success: boolean;
  createdBranches: string[];
  activeBranch: string;
  error?: string;
}

export class BranchSplitterWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;
  readonly runner: TransactionRunner;

  constructor(git: GitClient, snapshotManager: SnapshotManager, runner: TransactionRunner) {
    this.git = git;
    this.snapshotManager = snapshotManager;
    this.runner = runner;
  }

  /**
   * Split messy working directory into designated branches and commits.
   * Runs inside an atomic transaction; automatically rolls back on any error.
   */
  async splitChanges(request: SplitRequest): Promise<SplitResult> {
    if (!request.groups || request.groups.length === 0) {
      throw new Error('At least one split group must be defined');
    }

    const currentBranch = await this.git.getCurrentBranch();
    const baseBranch = request.baseBranch || currentBranch;
    const createdBranches: string[] = [];

    // Pre-validate branch names to fail fast
    for (const group of request.groups) {
      if (!group.branchName.trim()) {
        throw new Error('Branch name cannot be empty');
      }
      if (!group.commitMessage.trim()) {
        throw new Error(`Commit message cannot be empty for branch '${group.branchName}'`);
      }
      if (!group.files || group.files.length === 0) {
        throw new Error(`Group '${group.branchName}' has no files selected`);
      }

      // Check if branch already exists
      const branchExists = await this.git.getRef(`refs/heads/${group.branchName}`);
      if (branchExists) {
        throw new Error(`Branch '${group.branchName}' already exists. Choose a different branch name.`);
      }
    }

    // Capture snapshot of the full dirty state before splitting
    const snapshot = await this.snapshotManager.createSnapshot('pre-split');
    const snapshotSha = snapshot.snapshotSha;

    const txResult = await this.runner.runTransaction('split-changes', [
      {
        name: 'clean-working-tree-for-base',
        run: async (git) => {
          // Reset hard to base branch clean state
          await git.exec(['checkout', baseBranch]);
          await git.resetHard('HEAD');
        }
      },
      ...request.groups.map((group, idx) => ({
        name: `create-branch-${group.branchName}`,
        run: async (git: GitClient) => {
          // Checkout base branch
          await git.exec(['checkout', baseBranch]);

          // Create new branch from base branch
          await git.exec(['checkout', '-b', group.branchName]);
          createdBranches.push(group.branchName);

          // Restore only this group's files from the snapshot commit
          await git.exec(['checkout', snapshotSha, '--', ...group.files]);

          // Add and commit
          await git.exec(['add', ...group.files]);
          await git.exec(['commit', '-m', group.commitMessage]);

          return group.branchName;
        },
        rollback: async (git: GitClient) => {
          // Delete created branch if transaction rolls back
          await git.exec(['checkout', baseBranch], { allowFailure: true });
          await git.exec(['branch', '-D', group.branchName], { allowFailure: true });
        }
      })),
      {
        name: 'finalize-branch-selection',
        run: async (git) => {
          // Switch to the first created branch
          const target = createdBranches[0];
          await git.exec(['checkout', target]);
        }
      }
    ]);

    if (!txResult.success) {
      return {
        success: false,
        createdBranches: [],
        activeBranch: currentBranch,
        error: txResult.error?.message || 'Failed to split changes'
      };
    }

    return {
      success: true,
      createdBranches,
      activeBranch: createdBranches[0]
    };
  }
}
