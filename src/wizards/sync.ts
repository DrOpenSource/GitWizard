/**
 * SafeSyncWizard: Syncs local branch with remote repository.
 * Guarantees zero data loss: if any merge conflict or divergence occurs,
 * it immediately aborts and restores the working tree back to the pre-sync snapshot.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager, SnapshotMetadata } from '../engine/snapshot';

export interface SyncOptions {
  remote?: string;
  strategy?: 'rebase' | 'merge';
}

export interface SyncResult {
  success: boolean;
  message: string;
  snapshot: SnapshotMetadata;
  commitsPulled: number;
  conflictDetected: boolean;
  rolledBack: boolean;
}

export class SafeSyncWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;

  constructor(git: GitClient, snapshotManager: SnapshotManager) {
    this.git = git;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Safe sync flow with guaranteed rollback on conflict.
   */
  async safeSync(options: SyncOptions = {}): Promise<SyncResult> {
    const remote = options.remote || 'origin';
    const strategy = options.strategy || 'rebase';

    // 1. Take safety snapshot
    const snapshot = await this.snapshotManager.createSnapshot('pre-sync');

    try {
      // 2. Fetch remote
      const fetchRes = await this.git.exec(['fetch', remote], { allowFailure: true });
      if (fetchRes.exitCode !== 0) {
        // If remote doesn't exist (e.g. offline or no remote configured), fail gracefully
        return {
          success: false,
          message: `Unable to fetch from remote '${remote}': ${fetchRes.stderr}`,
          snapshot,
          commitsPulled: 0,
          conflictDetected: false,
          rolledBack: false
        };
      }

      // 3. Check tracking branch
      const upstreamRes = await this.git.exec(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFailure: true });
      if (upstreamRes.exitCode !== 0) {
        return {
          success: false,
          message: 'Current branch has no upstream tracking branch configured.',
          snapshot,
          commitsPulled: 0,
          conflictDetected: false,
          rolledBack: false
        };
      }
      const upstreamBranch = upstreamRes.stdout.trim();

      // Check how many commits upstream is ahead
      const countRes = await this.git.exec(['rev-list', '--count', `HEAD..${upstreamBranch}`], { allowFailure: true });
      const commitsAhead = countRes.exitCode === 0 ? parseInt(countRes.stdout.trim(), 10) || 0 : 0;

      if (commitsAhead === 0) {
        return {
          success: true,
          message: 'Branch is already up to date with remote.',
          snapshot,
          commitsPulled: 0,
          conflictDetected: false,
          rolledBack: false
        };
      }

      // 4. Stash uncommitted work if dirty before pulling/rebasing
      const statusBefore = await this.git.getStatus();
      let hasStashed = false;
      if (!statusBefore.isClean) {
        const stashRes = await this.git.exec(['stash', 'push', '-u', '-m', 'gitwizard-sync-temp'], { allowFailure: true });
        hasStashed = stashRes.exitCode === 0;
      }

      // 5. Attempt pull with specified strategy
      const syncArgs = strategy === 'rebase' ? ['rebase', upstreamBranch] : ['merge', upstreamBranch];
      const syncExec = await this.git.exec(syncArgs, { allowFailure: true });

      // Check if git is now in a conflict / mid-operation state
      const { inMerge, inRebase } = await this.git.checkMidOperationState();

      if (syncExec.exitCode !== 0 || inMerge || inRebase) {
        // CONFLICT DETECTED: Abort operation immediately!
        await this.git.abortInProgress();

        // Restore original working directory from snapshot
        await this.snapshotManager.restoreSnapshot(snapshot.id);

        return {
          success: false,
          message: 'Merge conflict detected with remote. Operation automatically aborted and your workspace was safely restored.',
          snapshot,
          commitsPulled: 0,
          conflictDetected: true,
          rolledBack: true
        };
      }

      // 6. Pop temp stash if created
      if (hasStashed) {
        const popRes = await this.git.exec(['stash', 'pop'], { allowFailure: true });
        if (popRes.exitCode !== 0) {
          // Stash pop conflict: Abort and restore from snapshot
          await this.snapshotManager.restoreSnapshot(snapshot.id);
          return {
            success: false,
            message: 'Conflict occurred when reapplying local changes. Workspace safely restored to snapshot.',
            snapshot,
            commitsPulled: 0,
            conflictDetected: true,
            rolledBack: true
          };
        }
      }

      return {
        success: true,
        message: `Successfully pulled ${commitsAhead} commit(s) from remote.`,
        snapshot,
        commitsPulled: commitsAhead,
        conflictDetected: false,
        rolledBack: false
      };
    } catch (err: any) {
      // Emergency master restore
      await this.git.abortInProgress();
      await this.snapshotManager.restoreSnapshot(snapshot.id);

      return {
        success: false,
        message: `Sync failed: ${err.message}. Workspace was safely rolled back.`,
        snapshot,
        commitsPulled: 0,
        conflictDetected: false,
        rolledBack: true
      };
    }
  }
}
