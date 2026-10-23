/**
 * GitWizard Pro: Production Branch Guard
 * Intercepts accidental commits or destructive operations directly onto
 * production/main branches, offering 1-click feature branch relocation.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';

export interface BranchGuardOptions {
  protectedBranches?: string[]; // Defaults to ['main', 'master', 'production', 'prod', 'release/*']
}

export interface GuardEvaluationResult {
  isProtected: boolean;
  branch: string;
  allowed: boolean;
  suggestedFeatureBranch?: string;
  reason?: string;
}

export interface RelocateResult {
  success: boolean;
  newBranch: string;
  message: string;
  error?: string;
}

const DEFAULT_PROTECTED_BRANCHES = ['main', 'master', 'production', 'prod', 'release/*'];

export class ProductionBranchGuard {
  private git: GitClient;
  private snapshotManager: SnapshotManager;
  private protectedPatterns: string[];

  constructor(
    git: GitClient,
    snapshotManager: SnapshotManager,
    options: BranchGuardOptions = {}
  ) {
    this.git = git;
    this.snapshotManager = snapshotManager;
    this.protectedPatterns = options.protectedBranches || DEFAULT_PROTECTED_BRANCHES;
  }

  /**
   * Tests if a branch name matches protected branch criteria.
   */
  isBranchProtected(branchName: string): boolean {
    const clean = branchName.trim();
    for (const pattern of this.protectedPatterns) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (clean.startsWith(prefix)) return true;
      } else {
        if (clean === pattern) return true;
      }
    }
    return false;
  }

  /**
   * Evaluates if committing or pushing on the current branch is allowed.
   */
  async evaluateAction(actionDescription: string = 'commit'): Promise<GuardEvaluationResult> {
    const status = await this.git.getStatus();
    const branch = status.branch;

    if (!this.isBranchProtected(branch)) {
      return {
        isProtected: false,
        branch,
        allowed: true
      };
    }

    const suggested = await this.suggestFeatureBranchName();

    return {
      isProtected: true,
      branch,
      allowed: false,
      suggestedFeatureBranch: suggested,
      reason: `Branch '${branch}' is protected. Direct ${actionDescription} is guarded to prevent accidental production breaks.`
    };
  }

  /**
   * Generates a sensible feature branch name from dirty files or timestamp.
   */
  async suggestFeatureBranchName(): Promise<string> {
    const status = await this.git.getStatus();
    const files = [...status.modified, ...status.staged, ...status.untracked];

    if (files.length > 0) {
      // Pick first interesting file name
      const sample = files[0];
      const parts = sample.split(/[\\/]/);
      const name = parts[parts.length - 1].replace(/\.[^/.]+$/, '').toLowerCase();
      const sanitized = name.replace(/[^a-z0-9_-]/g, '-').slice(0, 20);
      if (sanitized.length > 2) {
        return `feature/${sanitized}-edits`;
      }
    }

    const dateStr = new Date().toISOString().slice(5, 10).replace('-', '');
    return `feature/work-${dateStr}`;
  }

  /**
   * 1-Click Action: Safely relocates all uncommitted changes from protected branch to a new feature branch.
   */
  async relocateToFeatureBranch(newBranchName?: string): Promise<RelocateResult> {
    const status = await this.git.getStatus();
    const targetBranch = newBranchName?.trim() || (await this.suggestFeatureBranchName());

    // 1. Take a safety checkpoint first
    await this.snapshotManager.createSnapshot(`pre-guard-relocate-${status.branch}`);

    // 2. Create and switch to new feature branch
    const checkoutRes = await this.git.exec(['checkout', '-b', targetBranch], { allowFailure: true });
    if (checkoutRes.exitCode !== 0) {
      return {
        success: false,
        newBranch: targetBranch,
        message: 'Failed to create feature branch',
        error: checkoutRes.stderr || checkoutRes.stdout
      };
    }

    return {
      success: true,
      newBranch: targetBranch,
      message: `Safely relocated work to new branch '${targetBranch}'. Protected branch '${status.branch}' is untouched.`
    };
  }
}
