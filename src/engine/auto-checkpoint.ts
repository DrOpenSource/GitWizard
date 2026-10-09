/**
 * AutoCheckpointController: Passive, zero-effort flight recorder for vibe coders.
 * Silently captures shadow snapshots on debounced file edits before AI prompt sessions explode.
 */

import { GitClient } from './git-client';
import { SnapshotManager, SnapshotMetadata } from './snapshot';

export class AutoCheckpointController {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;
  private _debounceTimer: NodeJS.Timeout | null = null;
  private _lastSnapshotSha: string | null = null;
  private _maxAutoSnapshots: number = 15;
  private _isCapturing: boolean = false;

  constructor(git: GitClient, snapshotManager: SnapshotManager, maxAutoSnapshots: number = 15) {
    this.git = git;
    this.snapshotManager = snapshotManager;
    this._maxAutoSnapshots = maxAutoSnapshots;
  }

  /**
   * Schedule a debounced auto-checkpoint.
   * If further edits happen within delayMs, the timer resets.
   */
  scheduleAutoCheckpoint(reason: string = 'auto-edit', delayMs: number = 2500): Promise<SnapshotMetadata | null> {
    return new Promise((resolve) => {
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
      }

      this._debounceTimer = setTimeout(async () => {
        this._debounceTimer = null;
        try {
          const snap = await this.captureIfDirty(reason);
          resolve(snap);
        } catch {
          resolve(null);
        }
      }, delayMs);
    });
  }

  /**
   * Capture an auto-snapshot immediately if the workspace is dirty and changed.
   */
  async captureIfDirty(label: string = 'auto-edit'): Promise<SnapshotMetadata | null> {
    if (this._isCapturing) return null;
    this._isCapturing = true;

    try {
      const status = await this.git.getStatus();
      const dirtyCount = status.modified.length + status.staged.length + status.untracked.length;
      if (dirtyCount === 0) {
        return null; // clean working directory, no checkpoint needed
      }

      // Check current tree SHA to avoid duplicate snapshots if nothing actually changed
      const currentTree = await this.git.exec(['write-tree'], { allowFailure: true });
      if (currentTree.exitCode === 0 && currentTree.stdout.trim() === this._lastSnapshotSha) {
        return null;
      }

      const snap = await this.snapshotManager.createSnapshot(`auto-${label}`);
      this._lastSnapshotSha = currentTree.exitCode === 0 ? currentTree.stdout.trim() : null;

      // Clean up older auto-snapshots beyond max capacity
      await this.pruneOldAutoSnapshots();

      return snap;
    } finally {
      this._isCapturing = false;
    }
  }

  /**
   * Prune auto-snapshots beyond max limit to prevent disk and ref clutter
   */
  async pruneOldAutoSnapshots(): Promise<void> {
    try {
      const all = await this.snapshotManager.listSnapshots();
      const autoSnaps = all.filter((s) => s.label.startsWith('auto-'));
      if (autoSnaps.length > this._maxAutoSnapshots) {
        const toDelete = autoSnaps.slice(this._maxAutoSnapshots);
        for (const snap of toDelete) {
          await this.snapshotManager.deleteSnapshot(snap.id);
        }
      }
    } catch {
      // Ignore prune errors
    }
  }

  /**
   * Cancel any pending debounced timers
   */
  dispose() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }
}
