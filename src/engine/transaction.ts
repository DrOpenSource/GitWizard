/**
 * TransactionRunner: Orchestrates multi-step Git workflows with automated
 * rollback to a pre-transaction snapshot on any failure.
 */

import { GitClient } from './git-client';
import { SnapshotManager, SnapshotMetadata } from './snapshot';

export interface TransactionStep<T = any> {
  name: string;
  run(git: GitClient): Promise<T>;
  rollback?(git: GitClient): Promise<void>;
}

export interface TransactionResult {
  success: boolean;
  name: string;
  snapshot: SnapshotMetadata;
  results: any[];
  error?: Error;
  rolledBack?: boolean;
}

export class TransactionRunner {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;

  constructor(git: GitClient, snapshotManager: SnapshotManager) {
    this.git = git;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Execute an atomic pipeline of Git operations.
   * On failure, automatically restores repo to the pre-transaction snapshot.
   */
  async runTransaction(
    name: string,
    steps: TransactionStep[]
  ): Promise<TransactionResult> {
    // 1. Take safety snapshot before touching anything
    const snapshot = await this.snapshotManager.createSnapshot(`tx-${name}`);
    const results: any[] = [];
    const completedSteps: TransactionStep[] = [];

    try {
      for (const step of steps) {
        const stepResult = await step.run(this.git);
        results.push(stepResult);
        completedSteps.push(step);
      }

      return {
        success: true,
        name,
        snapshot,
        results
      };
    } catch (err: any) {
      // 2. Failure detected: execute step-level rollbacks in reverse
      for (const step of completedSteps.reverse()) {
        if (step.rollback) {
          try {
            await step.rollback(this.git);
          } catch (rollbackErr) {
            console.error(`Step rollback failed for ${step.name}:`, rollbackErr);
          }
        }
      }

      // 3. Master restore from pre-transaction snapshot
      try {
        await this.snapshotManager.restoreSnapshot(snapshot.id);
      } catch (restoreErr) {
        console.error('Critical: Failed to restore snapshot during transaction rollback:', restoreErr);
      }

      return {
        success: false,
        name,
        snapshot,
        results,
        error: err instanceof Error ? err : new Error(String(err)),
        rolledBack: true
      };
    }
  }
}
