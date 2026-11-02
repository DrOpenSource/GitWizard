/**
 * PullRequestWizard: Automated 1-Click Pull Request creation on GitHub.
 * Handles remote push, gh CLI integration with automatic browser web fallback,
 * and integration with AICommitWizard for title & description generation.
 */

import { GitClient } from '../engine/git-client';
import { AICommitWizard } from './ai-commit';
import { LicenseManager } from '../pro/license';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

export interface CreatePROptions {
  baseBranch?: string; // defaults to 'main'
  headBranch?: string; // defaults to current branch
  title?: string;
  body?: string;
  autoPush?: boolean; // defaults to true
  generateWithAI?: boolean; // if true and title/body missing, asks AI
}

export interface CreatePRResult {
  success: boolean;
  prUrl?: string;
  mode: 'cli' | 'web';
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
  message: string;
  error?: string;
}

export class PullRequestWizard {
  readonly git: GitClient;
  readonly aiCommitWizard?: AICommitWizard;
  readonly licenseManager?: LicenseManager;

  constructor(
    git: GitClient,
    aiCommitWizard?: AICommitWizard,
    licenseManager?: LicenseManager
  ) {
    this.git = git;
    this.aiCommitWizard = aiCommitWizard;
    this.licenseManager = licenseManager;
  }

  /**
   * Parse GitHub owner and repo name from remote URL.
   * Handles HTTPS, SSH, and git:// formats.
   */
  static parseGitHubRemote(remoteUrl: string): GitHubRepoInfo | null {
    if (!remoteUrl) return null;
    const cleanUrl = remoteUrl.trim();
    const match = cleanUrl.match(
      /(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/
    );
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
    return null;
  }

  /**
   * Generates a 1-click web compare URL for creating a PR on GitHub in the browser.
   */
  static getCompareWebUrl(options: {
    owner: string;
    repo: string;
    baseBranch: string;
    headBranch: string;
    title?: string;
    body?: string;
  }): string {
    const { owner, repo, baseBranch, headBranch, title, body } = options;
    const params = new URLSearchParams();
    params.set('expand', '1');
    if (title) params.set('title', title);
    if (body) params.set('body', body);
    return `https://github.com/${owner}/${repo}/compare/${baseBranch}...${headBranch}?${params.toString()}`;
  }

  /**
   * Check if GitHub CLI (gh) is available in PATH.
   */
  async isGhCliAvailable(): Promise<boolean> {
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      await execFileAsync('gh', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executes 1-click PR creation.
   */
  async createPullRequest(options: CreatePROptions = {}): Promise<CreatePRResult> {
    const currentBranch = await this.git.getCurrentBranch();
    const headBranch = options.headBranch || currentBranch;
    const baseBranch = options.baseBranch || 'main';

    if (headBranch === baseBranch) {
      throw new Error(`Cannot create Pull Request from '${headBranch}' into itself. Please switch to or create a feature branch first.`);
    }

    // 1. Get remote URL
    const remoteUrlRes = await this.git.exec(['remote', 'get-url', 'origin'], { allowFailure: true });
    if (remoteUrlRes.exitCode !== 0 || !remoteUrlRes.stdout.trim()) {
      throw new Error("No remote 'origin' found. Connect your project to GitHub first before creating a Pull Request.");
    }
    const remoteUrl = remoteUrlRes.stdout.trim();
    const repoInfo = PullRequestWizard.parseGitHubRemote(remoteUrl);

    // 2. Auto-push head branch to origin if requested
    if (options.autoPush !== false) {
      const pushRes = await this.git.exec(['push', '-u', 'origin', headBranch], { allowFailure: true });
      if (pushRes.exitCode !== 0) {
        throw new Error(`Failed to push branch '${headBranch}' to remote origin: ${pushRes.stderr}`);
      }
    }

    // 3. Determine Title & Body
    let title = options.title?.trim() || '';
    let body = options.body?.trim() || '';

    if ((!title || !body) && options.generateWithAI && this.aiCommitWizard) {
      try {
        const aiPr = await this.aiCommitWizard.generatePRDescription(baseBranch);
        if (aiPr.success) {
          if (!title && aiPr.title) title = aiPr.title;
          if (!body && aiPr.body) body = aiPr.body;
        }
      } catch {
        // Fall back to default title if AI generation errors
      }
    }

    if (!title) {
      title = `feat(${headBranch}): updates from ${headBranch}`;
    }
    if (!body) {
      body = `### 🎯 Pull Request Summary\nCreated with GitWizard from \`${headBranch}\` into \`${baseBranch}\`.`;
    }

    // 4. Check if gh CLI is available
    const hasGh = await this.isGhCliAvailable();
    if (hasGh) {
      try {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync('gh', [
          'pr',
          'create',
          '--base',
          baseBranch,
          '--head',
          headBranch,
          '--title',
          title,
          '--body',
          body
        ], { cwd: this.git.repoPath });

        const prUrl = stdout.trim();
        return {
          success: true,
          prUrl: prUrl || undefined,
          mode: 'cli',
          headBranch,
          baseBranch,
          title,
          body,
          message: `Pull Request created via GitHub CLI: ${prUrl}`
        };
      } catch {
        // gh CLI failed (not authenticated or repo not linked); fall back to web URL
      }
    }

    // 5. Fallback to web compare URL
    if (repoInfo) {
      const webUrl = PullRequestWizard.getCompareWebUrl({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        baseBranch,
        headBranch,
        title,
        body
      });

      return {
        success: true,
        prUrl: webUrl,
        mode: 'web',
        headBranch,
        baseBranch,
        title,
        body,
        message: 'Opening GitHub in browser to finalize your Pull Request.'
      };
    }

    return {
      success: false,
      mode: 'web',
      headBranch,
      baseBranch,
      title,
      body,
      message: 'Could not determine GitHub repository owner and name from remote URL.',
      error: `Unsupported remote URL format: ${remoteUrl}`
    };
  }
}

