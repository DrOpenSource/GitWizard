/**
 * DailyEssentialsWizard: Plain-English everyday Git primitives for vibe coders.
 * (Commit, Push, Pull, Uncommit, Branch) backed by zero-data-loss snapshots.
 */

import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import { SecretScanner, DetectedSecret } from '../pro/secret-scanner';
import { ProductionBranchGuard } from '../pro/branch-guard';
import fs from 'node:fs';
import path from 'node:path';

export interface SafeCommitOptions {
  allowProtected?: boolean;
  ignoreSecrets?: boolean;
  authorName?: string;
  authorEmail?: string;
}

export interface EssentialResult {
  success: boolean;
  message: string;
  detail?: string;
  rolledBack?: boolean;
  isProtectedBranch?: boolean;
  suggestedFeatureBranch?: string;
  hasSecrets?: boolean;
  secrets?: DetectedSecret[];
  requiresIdentity?: boolean;
  needsInit?: boolean;
  requiresRemote?: boolean;
}

export class DailyEssentialsWizard {
  readonly git: GitClient;
  readonly snapshotManager: SnapshotManager;
  readonly branchGuard?: ProductionBranchGuard;
  readonly secretScanner?: SecretScanner;

  constructor(
    git: GitClient,
    snapshotManager: SnapshotManager,
    branchGuard?: ProductionBranchGuard,
    secretScanner?: SecretScanner
  ) {
    this.git = git;
    this.snapshotManager = snapshotManager;
    this.branchGuard = branchGuard;
    this.secretScanner = secretScanner;
  }

  /**
   * Safe Commit: Stages all changes and commits with a user message.
   * Takes a safety snapshot beforehand. Protected branches and secrets are guarded.
   */
  async safeCommit(commitMessage: string, options: SafeCommitOptions = {}): Promise<EssentialResult> {
    const trimmed = commitMessage.trim();
    if (!trimmed) {
      throw new Error('Please enter a commit message describing your changes.');
    }

    const status = await this.git.getStatus();
    if (status.isRepo === false) {
      return {
        success: false,
        needsInit: true,
        message: 'Git is not initialized in this project yet. Please enable Safe Mode first.'
      };
    }

    const dirtyCount = status.modified.length + status.staged.length + status.untracked.length;
    if (dirtyCount === 0) {
      return {
        success: false,
        message: 'No changes to commit. Your workspace is completely clean!'
      };
    }

    // 0. Pre-Flight Author Identity check
    if (options.authorName && options.authorEmail) {
      await this.git.setLocalAuthorIdentity(options.authorName, options.authorEmail);
    } else {
      const identity = await this.git.getAuthorIdentity();
      if (!identity.isComplete) {
        return {
          success: false,
          requiresIdentity: true,
          message: 'Git requires a display name and email to save your work history.'
        };
      }
    }

    // 1. Production Branch Guard check
    if (this.branchGuard && !options.allowProtected) {
      const guardEval = await this.branchGuard.evaluateAction('commit');
      if (!guardEval.allowed) {
        return {
          success: false,
          isProtectedBranch: true,
          suggestedFeatureBranch: guardEval.suggestedFeatureBranch,
          message: guardEval.reason || `Branch '${guardEval.branch}' is protected.`
        };
      }
    }

    // 2. Pre-Flight Secret Radar check
    if (this.secretScanner && !options.ignoreSecrets) {
      const secrets = await this.scanWorkingTreeForSecrets();
      if (secrets.length > 0) {
        return {
          success: false,
          hasSecrets: true,
          secrets,
          message: `GitWizard Secret Radar: Found ${secrets.length} exposed secret(s) in your changes.`
        };
      }
    }

    // Safety snapshot
    await this.snapshotManager.createSnapshot('pre-commit-safety');

    // Stage all
    await this.git.exec(['add', '-A']);

    // Commit
    const res = await this.git.exec(['commit', '-m', trimmed], { allowFailure: true });
    if (res.exitCode !== 0) {
      if (
        res.stderr.includes('empty ident name') ||
        res.stderr.includes('tell me who you are') ||
        res.stderr.includes('auto-detect')
      ) {
        return {
          success: false,
          requiresIdentity: true,
          message: 'Please provide a display name and email for your project saves.'
        };
      }
      throw new Error(`Git commit failed: ${res.stderr || res.stdout}`);
    }

    const headRes = await this.git.exec(['rev-parse', '--short', 'HEAD'], { allowFailure: true });
    const shortSha = headRes.stdout ? headRes.stdout.trim() : 'HEAD';

    return {
      success: true,
      message: `Safely saved commit [${shortSha}]: "${trimmed}"`,
      detail: res.stdout
    };
  }

  private async scanWorkingTreeForSecrets(): Promise<DetectedSecret[]> {
    if (!this.secretScanner) return [];

    const found: DetectedSecret[] = [];

    // 1. Scan diff against HEAD
    const diffRes = await this.git.exec(['diff', 'HEAD'], { allowFailure: true });
    if (diffRes.stdout) {
      const diffScan = this.secretScanner.scanContent(diffRes.stdout, 'working-tree-diff');
      found.push(...diffScan.secrets);
    }

    // 2. Scan untracked files
    const status = await this.git.getStatus();
    for (const file of status.untracked) {
      if (/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|exe|dll|so|woff|woff2)$/i.test(file)) continue;
      if (file.endsWith('-lock.json') || file.endsWith('.lock')) continue;

      const fullPath = path.isAbsolute(file) ? file : path.join(this.git.repoPath, file);
      try {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).size < 1000000) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const fileScan = this.secretScanner.scanContent(content, file);
          found.push(...fileScan.secrets);
        }
      } catch {}
    }

    return found;
  }

  /**
   * Safe Uncommit: Safely undoes the last commit without losing ANY working tree files (soft reset).
   */
  async safeUncommit(): Promise<EssentialResult> {
    const headRes = await this.git.exec(['rev-parse', 'HEAD~1'], { allowFailure: true });
    if (headRes.exitCode !== 0) {
      throw new Error('Cannot undo commit: Repository only has 1 commit or HEAD has no parent.');
    }

    // Safety snapshot
    await this.snapshotManager.createSnapshot('pre-uncommit-safety');

    // Soft reset moves HEAD back by 1 without modifying working tree or deleting files
    await this.git.exec(['reset', '--soft', 'HEAD~1']);

    return {
      success: true,
      message: 'Uncommitted last commit! All your modified files were safely preserved.'
    };
  }

  /**
   * Check if a remote origin exists in repository configuration
   */
  async hasRemote(remote: string = 'origin'): Promise<boolean> {
    const res = await this.git.exec(['remote'], { allowFailure: true });
    if (res.exitCode !== 0 || !res.stdout) return false;
    const remotes = res.stdout.split('\n').map(r => r.trim()).filter(Boolean);
    return remotes.includes(remote);
  }

  /**
   * Configure or update remote URL for cloud sync
   */
  async setRemoteUrl(url: string, remote: string = 'origin'): Promise<{ success: boolean; message: string }> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      return { success: false, message: 'Repository URL cannot be empty.' };
    }
    const exists = await this.hasRemote(remote);
    const cmd = exists ? ['remote', 'set-url', remote, cleanUrl] : ['remote', 'add', remote, cleanUrl];
    const res = await this.git.exec(cmd, { allowFailure: true });
    if (res.exitCode !== 0) {
      return { success: false, message: res.stderr || 'Failed to configure remote URL.' };
    }
    return { success: true, message: `Connected to ${cleanUrl} successfully.` };
  }

  /**
   * Safe Push: Sends current branch to remote origin with automatic upstream tracking.
   */
  async safePush(remote: string = 'origin'): Promise<EssentialResult> {
    const branch = await this.git.getCurrentBranch();
    if (branch === 'HEAD (detached)') {
      throw new Error('Cannot push in detached HEAD state. Please switch to a branch first.');
    }

    const remoteExists = await this.hasRemote(remote);
    if (!remoteExists) {
      return {
        success: false,
        requiresRemote: true,
        message: `Remote '${remote}' is not configured yet. Link your GitHub repository URL to enable cloud backup.`
      };
    }

    // Attempt push with upstream tracking
    const res = await this.git.exec(['push', '-u', remote, branch], { allowFailure: true, timeoutMs: 30000 });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Push to ${remote}/${branch} failed: ${res.stderr || res.stdout}`
      };
    }

    return {
      success: true,
      message: `Pushed '${branch}' successfully to ${remote}!`,
      detail: res.stdout || res.stderr
    };
  }

  /**
   * Safe Pull: Fetches and integrates updates from remote, aborting and restoring if conflicts occur.
   */
  async safePull(remote: string = 'origin'): Promise<EssentialResult> {
    const branch = await this.git.getCurrentBranch();
    if (branch === 'HEAD (detached)') {
      throw new Error('Cannot pull in detached HEAD state.');
    }

    const remoteExists = await this.hasRemote(remote);
    if (!remoteExists) {
      return {
        success: false,
        requiresRemote: true,
        message: `Remote '${remote}' is not configured yet. Link your GitHub repository URL to get updates.`
      };
    }

    // 1. Take safety snapshot of current state
    const prePullSnap = await this.snapshotManager.createSnapshot('pre-pull-safety');

    // 2. Try pull
    const res = await this.git.exec(['pull', remote, branch], { allowFailure: true, timeoutMs: 30000 });
    if (res.exitCode !== 0) {
      // Conflict or failure detected -> cleanly abort and restore
      await this.git.abortInProgress();
      await this.snapshotManager.restoreSnapshot(prePullSnap.id);

      return {
        success: false,
        rolledBack: true,
        message: `Remote pull caused conflicts or failed. Workspace was safely restored to your exact state before pull!`,
        detail: res.stderr || res.stdout
      };
    }

    return {
      success: true,
      message: `Successfully updated '${branch}' with latest changes from ${remote}!`,
      detail: res.stdout
    };
  }

  /**
   * Create & Switch Branch: Creates a new feature branch and switches to it safely.
   */
  async createBranch(branchName: string): Promise<EssentialResult> {
    const cleanName = branchName.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\/]/g, '');
    if (!cleanName) {
      throw new Error('Please enter a valid branch name.');
    }

    await this.snapshotManager.createSnapshot('pre-branch-safety');

    const res = await this.git.exec(['checkout', '-b', cleanName], { allowFailure: true });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to create branch '${cleanName}': ${res.stderr || res.stdout}`
      };
    }

    return {
      success: true,
      message: `Created and switched to new branch '${cleanName}'!`
    };
  }

  /**
   * Switch Branch safely.
   */
  async switchBranch(branchName: string): Promise<EssentialResult> {
    const cleanName = branchName.trim();
    if (!cleanName) {
      throw new Error('Please enter a branch name to switch to.');
    }

    await this.snapshotManager.createSnapshot('pre-switch-safety');

    const res = await this.git.exec(['checkout', cleanName], { allowFailure: true });
    if (res.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to switch to '${cleanName}': ${res.stderr || res.stdout}`
      };
    }

    return {
      success: true,
      message: `Switched to branch '${cleanName}'!`
    };
  }
}
