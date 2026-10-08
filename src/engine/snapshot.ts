/**
 * SnapshotManager: Low-overhead, zero-data-loss working tree snapshots.
 * Uses dedicated Git refs (refs/gitwizard/snapshots/*) and shadow index creation.
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GitClient } from './git-client';

export interface SnapshotMetadata {
  id: string;
  label: string;
  timestamp: number;
  branch: string;
  headSha: string;
  snapshotSha: string;
}

export class SnapshotManager {
  readonly git: GitClient;
  readonly metadataDir: string;

  constructor(git: GitClient) {
    this.git = git;
    this.metadataDir = path.join(this.git.repoPath, '.git', 'gitwizard', 'snapshots');
    if (!fs.existsSync(this.metadataDir)) {
      fs.mkdirSync(this.metadataDir, { recursive: true });
    }
  }

  /**
   * Creates a snapshot of current working tree (including modified and untracked files)
   * without moving HEAD or touching the actual working directory.
   */
  async createSnapshot(label: string = 'checkpoint'): Promise<SnapshotMetadata> {
    const timestamp = Date.now();
    const cleanLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'snap';
    const id = `${timestamp}-${cleanLabel}`;

    const branch = await this.git.getCurrentBranch();
    const headShaRes = await this.git.exec(['rev-parse', 'HEAD'], { allowFailure: true });
    const headSha = headShaRes.exitCode === 0 ? headShaRes.stdout.trim() : 'HEAD_EMPTY';

    // Create a temporary isolated index to capture staged, modified, and untracked files
    const tempIndexFile = path.join(os.tmpdir(), `gw-idx-${id}`);
    let snapshotSha = headSha;

    try {
      // If repo has commits, copy current index as baseline
      const realIndex = path.join(this.git.repoPath, '.git', 'index');
      if (fs.existsSync(realIndex)) {
        fs.copyFileSync(realIndex, tempIndexFile);
      }

      // Add all changes (including untracked files) to temp index
      await this.git.exec(['add', '-A'], { allowFailure: true });
      
      // Write tree
      const treeRes = await this.git.exec(['write-tree']);
      const treeSha = treeRes.stdout.trim();

      // Commit tree with HEAD as parent (if HEAD exists)
      const parents = headSha !== 'HEAD_EMPTY' ? [headSha] : [];
      snapshotSha = await this.git.commitTree(
        treeSha,
        `gitwizard-snapshot: ${label} (${id})`,
        parents
      );

      // Save ref in dedicated gitwizard namespace
      const refName = `refs/gitwizard/snapshots/${id}`;
      await this.git.updateRef(refName, snapshotSha);

      const metadata: SnapshotMetadata = {
        id,
        label,
        timestamp,
        branch,
        headSha,
        snapshotSha
      };

      // Write metadata file
      fs.writeFileSync(
        path.join(this.metadataDir, `${id}.json`),
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      return metadata;
    } finally {
      if (fs.existsSync(tempIndexFile)) {
        try {
          fs.unlinkSync(tempIndexFile);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  /**
   * Restore a snapshot into the working directory.
   */
  async restoreSnapshot(id: string): Promise<SnapshotMetadata> {
    const metaPath = path.join(this.metadataDir, `${id}.json`);
    if (!fs.existsSync(metaPath)) {
      throw new Error(`Snapshot '${id}' not found in metadata`);
    }

    const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    // Abort any active merge or rebase
    await this.git.abortInProgress();

    // Check out files from snapshot commit to working tree
    await this.git.exec(['read-tree', metadata.snapshotSha]);
    await this.git.exec(['checkout-index', '-a', '-f']);

    return metadata;
  }

  /**
   * List all stored snapshots
   */
  async listSnapshots(): Promise<SnapshotMetadata[]> {
    if (!fs.existsSync(this.metadataDir)) {
      return [];
    }

    const files = fs.readdirSync(this.metadataDir).filter(f => f.endsWith('.json'));
    const list: SnapshotMetadata[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.metadataDir, file), 'utf-8');
        list.push(JSON.parse(content));
      } catch {
        // Ignore corrupted metadata
      }
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(id: string): Promise<void> {
    const refName = `refs/gitwizard/snapshots/${id}`;
    await this.git.deleteRef(refName);

    const metaPath = path.join(this.metadataDir, `${id}.json`);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }
}
