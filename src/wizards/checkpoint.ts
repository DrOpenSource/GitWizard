/**
 * CheckpointWizard: High-level intent flow for taking and restoring instant checkpoints.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager, SnapshotMetadata } from '../engine/snapshot';

export interface CheckpointDiffFile {
  path: string;
  status: 'modified' | 'added' | 'deleted';
}

export class CheckpointWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;

  constructor(git: GitClient, snapshotManager: SnapshotManager) {
    this.git = git;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Save an instant safety checkpoint with a friendly user label.
   */
  async saveCheckpoint(label: string): Promise<SnapshotMetadata> {
    const cleanLabel = label.trim() || 'vibe-save';
    return await this.snapshotManager.createSnapshot(cleanLabel);
  }

  /**
   * List all saved checkpoints, sorted newest first.
   */
  async listCheckpoints(): Promise<SnapshotMetadata[]> {
    return await this.snapshotManager.listSnapshots();
  }

  /**
   * Restore working directory to a specific checkpoint.
   * Automatically takes a safety backup before restoring.
   */
  async restoreCheckpoint(snapshotId: string): Promise<SnapshotMetadata> {
    // Take safety snapshot before restoring, so the restore action itself can be undone
    await this.snapshotManager.createSnapshot('pre-restore-backup');
    return await this.snapshotManager.restoreSnapshot(snapshotId);
  }

  /**
   * Delete a saved checkpoint.
   */
  async deleteCheckpoint(snapshotId: string): Promise<void> {
    await this.snapshotManager.deleteSnapshot(snapshotId);
  }

  /**
   * Get list of changed files between current working tree and a checkpoint.
   */
  async getDiffWithCurrent(snapshotId: string): Promise<CheckpointDiffFile[]> {
    const ref = `refs/gitwizard/snapshots/${snapshotId}`;
    const snapSha = await this.git.getRef(ref);
    if (!snapSha) {
      throw new Error(`Checkpoint ref not found: ${ref}`);
    }

    const res = await this.git.exec(['diff', '--name-status', snapSha], { allowFailure: true });
    if (res.exitCode !== 0 || !res.stdout) {
      return [];
    }

    return res.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('\t');
        const code = parts[0];
        const filePath = parts[1] || '';
        let status: 'modified' | 'added' | 'deleted' = 'modified';
        if (code === 'A') status = 'added';
        else if (code === 'D') status = 'deleted';
        return { path: filePath, status };
      });
  }
}
