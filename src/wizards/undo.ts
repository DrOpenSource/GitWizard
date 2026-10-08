/**
 * UndoWizard: "Time Machine" for vibe coders.
 * Parses git reflog into human-friendly events and safely unwinds mistakes.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager, SnapshotMetadata } from '../engine/snapshot';

export interface HumanGitAction {
  hash: string;
  selector: string; // e.g. HEAD@{0}
  rawMessage: string;
  category: 'commit' | 'merge' | 'checkout' | 'rebase' | 'reset' | 'other';
  title: string;
  timestamp: string;
}

export interface UndoResult {
  success: boolean;
  message: string;
  snapshot: SnapshotMetadata;
  targetRef: string;
}

export class UndoWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;

  constructor(git: GitClient, snapshotManager: SnapshotManager) {
    this.git = git;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Parse git reflog entries into human-readable actions.
   */
  async getRecentActions(limit: number = 15): Promise<HumanGitAction[]> {
    const res = await this.git.exec(['reflog', `-n`, String(limit), '--format=%h\t%gd\t%gs\t%ci'], { allowFailure: true });
    if (res.exitCode !== 0 || !res.stdout) {
      return [];
    }

    const lines = res.stdout.split('\n').filter(Boolean);
    const actions: HumanGitAction[] = [];

    for (const line of lines) {
      const [hash, selector, rawMessage, timestamp] = line.split('\t');
      if (!hash || !selector) continue;

      const { category, title } = this.categorizeAction(rawMessage || '');
      actions.push({
        hash: hash.trim(),
        selector: selector.trim(),
        rawMessage: rawMessage ? rawMessage.trim() : '',
        category,
        title,
        timestamp: timestamp ? timestamp.trim() : ''
      });
    }

    return actions;
  }

  /**
   * Convert cryptic Git reflog message into clear English for vibe coders.
   */
  private categorizeAction(msg: string): { category: HumanGitAction['category']; title: string } {
    if (msg.startsWith('commit:')) {
      return {
        category: 'commit',
        title: `Committed: "${msg.replace('commit:', '').trim()}"`
      };
    }
    if (msg.startsWith('commit (amend):')) {
      return {
        category: 'commit',
        title: `Amended Commit: "${msg.replace('commit (amend):', '').trim()}"`
      };
    }
    if (msg.startsWith('merge')) {
      return {
        category: 'merge',
        title: `Merged: "${msg.trim()}"`
      };
    }
    if (msg.startsWith('checkout: moving from')) {
      const match = msg.match(/checkout: moving from (\S+) to (\S+)/);
      if (match) {
        return {
          category: 'checkout',
          title: `Switched branch from ${match[1]} to ${match[2]}`
        };
      }
      return {
        category: 'checkout',
        title: 'Switched branch / checkout'
      };
    }
    if (msg.startsWith('rebase')) {
      return {
        category: 'rebase',
        title: `Rebase: "${msg.trim()}"`
      };
    }
    if (msg.startsWith('reset: moving to')) {
      return {
        category: 'reset',
        title: `Reset: "${msg.trim()}"`
      };
    }

    return {
      category: 'other',
      title: msg || 'Unknown Git event'
    };
  }

  /**
   * Undo the most recent action (rewinds to HEAD@{1}).
   * Takes a safety snapshot before undoing.
   */
  async undoLastAction(): Promise<UndoResult> {
    return await this.revertToReflogSelector('HEAD@{1}');
  }

  /**
   * Reverts working tree and HEAD to a specific reflog selector (e.g., HEAD@{2}).
   * Always creates an automated safety snapshot before executing.
   */
  async revertToReflogSelector(selector: string): Promise<UndoResult> {
    // 1. Take safety snapshot
    const snapshot = await this.snapshotManager.createSnapshot(`pre-undo-${selector.replace(/[^a-zA-Z0-9]/g, '-')}`);

    try {
      // 2. Abort any active merge/rebase
      await this.git.abortInProgress();

      // 3. Move HEAD and working tree to target reflog entry
      await this.git.exec(['reset', '--hard', selector]);

      return {
        success: true,
        message: `Successfully rewound workspace to ${selector}.`,
        snapshot,
        targetRef: selector
      };
    } catch (err: any) {
      // Rollback if reset failed
      await this.snapshotManager.restoreSnapshot(snapshot.id);
      throw new Error(`Failed to rewind to ${selector}: ${err.message}. Workspace was safely preserved.`);
    }
  }
}
