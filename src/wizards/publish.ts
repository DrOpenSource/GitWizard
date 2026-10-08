/**
 * RepoSplitterWizard: Splits a local branch into a brand new standalone GitHub repository.
 * Perfect for vibe coders who started an experiment on a branch and want to promote it to its own repo.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager, SnapshotMetadata } from '../engine/snapshot';
import { TransactionRunner } from '../engine/transaction';

export interface SplitToNewRepoOptions {
  sourceBranch: string;
  newRepoName: string;
  targetBranch?: string; // defaults to 'main'
  visibility?: 'public' | 'private';
  description?: string;
  customRemoteUrl?: string; // optional override if already created or using custom git server
}

export interface SplitToNewRepoResult {
  success: boolean;
  repoUrl: string;
  sourceBranch: string;
  targetBranch: string;
  message: string;
  snapshot: SnapshotMetadata;
  error?: string;
}

export class RepoSplitterWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;
  readonly runner: TransactionRunner;

  constructor(git: GitClient, snapshotManager: SnapshotManager, runner: TransactionRunner) {
    this.git = git;
    this.snapshotManager = snapshotManager;
    this.runner = runner;
  }

  /**
   * Promotes and splits a local branch into a new standalone repository.
   */
  async splitToNewRepo(options: SplitToNewRepoOptions): Promise<SplitToNewRepoResult> {
    const {
      sourceBranch,
      newRepoName,
      targetBranch = 'main',
      visibility = 'public',
      description = 'Created with GitWizard'
    } = options;

    // 1. Verify source branch exists
    const branchRef = await this.git.getRef(`refs/heads/${sourceBranch}`);
    if (!branchRef) {
      throw new Error(`Source branch '${sourceBranch}' does not exist.`);
    }

    // 2. Take safety snapshot
    const snapshot = await this.snapshotManager.createSnapshot(`pre-split-repo-${newRepoName}`);

    let remoteUrl = options.customRemoteUrl || '';
    const tempRemoteName = `remote-${newRepoName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    try {
      // 3. If no custom remote URL provided, use GitHub CLI (gh) to create the repo
      if (!remoteUrl) {
        // Test gh availability
        const ghCheck = await this.git.exec(['--version']); // base check
        try {
          const { execFile } = await import('node:child_process');
          const { promisify } = await import('node:util');
          const execFileAsync = promisify(execFile);

          // Create repo on GitHub using gh CLI
          const ghArgs = [
            'repo',
            'create',
            newRepoName,
            `--${visibility}`,
            '--description',
            description
          ];

          await execFileAsync('gh', ghArgs, { cwd: this.git.repoPath });

          // Retrieve created repo clone URL
          const viewRes = await execFileAsync(
            'gh',
            ['repo', 'view', newRepoName, '--json', 'url', '-q', '.url'],
            { cwd: this.git.repoPath }
          );
          remoteUrl = `${viewRes.stdout.trim()}.git`;
        } catch (ghErr: any) {
          throw new Error(`GitHub CLI repository creation failed: ${ghErr.message}`);
        }
      }

      // 4. Add temporary remote pointing to new repository
      // Check if remote already exists, remove it first if stale
      await this.git.exec(['remote', 'remove', tempRemoteName], { allowFailure: true });
      await this.git.exec(['remote', 'add', tempRemoteName, remoteUrl]);

      // 5. Push source branch to target branch (e.g. template/antigravity-starter -> main)
      const pushRes = await this.git.exec(
        ['push', '-u', tempRemoteName, `${sourceBranch}:${targetBranch}`],
        { allowFailure: true }
      );

      if (pushRes.exitCode !== 0) {
        throw new Error(`Failed to push branch to new repository: ${pushRes.stderr}`);
      }

      return {
        success: true,
        repoUrl: remoteUrl,
        sourceBranch,
        targetBranch,
        message: `Successfully published branch '${sourceBranch}' as '${targetBranch}' to new repository: ${remoteUrl}`,
        snapshot
      };
    } catch (err: any) {
      // Rollback: clean up added remote and restore snapshot if necessary
      await this.git.exec(['remote', 'remove', tempRemoteName], { allowFailure: true });
      await this.snapshotManager.restoreSnapshot(snapshot.id);

      return {
        success: false,
        repoUrl: remoteUrl,
        sourceBranch,
        targetBranch,
        message: `Failed to split branch to new repo: ${err.message}`,
        snapshot,
        error: err.message
      };
    }
  }

  /**
   * Safe helper to push current branch to origin
   */
  async pushToOrigin(branch: string = 'main'): Promise<{ success: boolean; message: string }> {
    const res = await this.git.exec(['push', '-u', 'origin', branch], { allowFailure: true });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to push '${branch}' to origin: ${res.stderr}`
      };
    }
    return {
      success: true,
      message: `Successfully pushed '${branch}' to origin.`
    };
  }
}
