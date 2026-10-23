/**
 * GitWizard Pro: Surgical Per-File Rewind Engine
 * Allows vibe coders to restore an individual file from any prior safety checkpoint
 * without rolling back or disturbing any other modified files in the workspace.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import fs from 'node:fs';
import path from 'node:path';

export interface FileRewindResult {
  success: boolean;
  filePath: string;
  snapshotId: string;
  snapshotLabel?: string;
  message: string;
  error?: string;
}

export class FileRewindEngine {
  private git: GitClient;
  private snapshotManager: SnapshotManager;

  constructor(git: GitClient, snapshotManager: SnapshotManager) {
    this.git = git;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Surgically restores a single file from a given snapshot commit.
   * Other modified files and git status remain completely untouched.
   */
  async rewindFile(snapshotId: string, relativeFilePath: string): Promise<FileRewindResult> {
    const cleanPath = relativeFilePath.replace(/^[\\/]+/, '').replace(/\\/g, '/');

    // 1. Verify snapshot exists
    const snapshots = await this.snapshotManager.listSnapshots();
    const snap = snapshots.find(s => s.id === snapshotId);
    if (!snap) {
      return {
        success: false,
        filePath: cleanPath,
        snapshotId,
        message: 'Snapshot not found',
        error: `No snapshot found with ID '${snapshotId}'.`
      };
    }

    // 2. Verify file existed in that snapshot commit
    const catCheck = await this.git.exec(['cat-file', '-e', `${snap.snapshotSha}:${cleanPath}`], { allowFailure: true });
    if (catCheck.exitCode !== 0) {
      return {
        success: false,
        filePath: cleanPath,
        snapshotId,
        snapshotLabel: snap.label,
        message: 'File not found in snapshot',
        error: `File '${cleanPath}' did not exist in snapshot '${snap.label}' (${snapshotId.slice(0, 7)}).`
      };
    }

    // 3. Take a quick safety snapshot before overwriting
    const sanitizedLabel = cleanPath.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
    await this.snapshotManager.createSnapshot(`pre-file-rewind-${sanitizedLabel}`);

    // 4. Extract and restore only this file using checkout from snapshot ref
    const checkoutRes = await this.git.exec(
      ['checkout', snap.snapshotSha, '--', cleanPath],
      { allowFailure: true }
    );

    if (checkoutRes.exitCode !== 0) {
      return {
        success: false,
        filePath: cleanPath,
        snapshotId,
        snapshotLabel: snap.label,
        message: 'Failed to restore file from snapshot',
        error: checkoutRes.stderr || checkoutRes.stdout
      };
    }

    // 5. Unstage the file so it remains an uncommitted modification in the working tree
    await this.git.exec(['reset', 'HEAD', cleanPath], { allowFailure: true });

    return {
      success: true,
      filePath: cleanPath,
      snapshotId,
      snapshotLabel: snap.label,
      message: `Surgically restored '${cleanPath}' to state from snapshot '${snap.label}'. Other files were not touched.`
    };
  }

  /**
   * Retrieves the content of a file from a snapshot without modifying the workspace disk.
   */
  async getSnapshotFileContent(snapshotId: string, relativeFilePath: string): Promise<string | null> {
    const cleanPath = relativeFilePath.replace(/^[\\/]+/, '').replace(/\\/g, '/');
    const snapshots = await this.snapshotManager.listSnapshots();
    const snap = snapshots.find(s => s.id === snapshotId);
    if (!snap) return null;

    const res = await this.git.exec(['show', `${snap.snapshotSha}:${cleanPath}`], { allowFailure: true });
    if (res.exitCode !== 0) return null;
    return res.stdout;
  }
}
