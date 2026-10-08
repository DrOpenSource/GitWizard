/**
 * Safe, typed Git client wrapping system Git CLI operations.
 * Pure Node.js implementation without external Git dependencies.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GitRepoStatus {
  branch: string;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  inMerge: boolean;
  inRebase: boolean;
}

export interface RefInfo {
  ref: string;
  sha: string;
}

export class GitClient {
  readonly repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Execute raw git command with safety timeout
   */
  async exec(args: string[], options: { timeoutMs?: number; allowFailure?: boolean } = {}): Promise<GitExecResult> {
    const timeout = options.timeoutMs ?? 15000;
    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd: this.repoPath,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Never hang waiting for interactive terminal credentials
          GIT_PAGER: 'cat'
        }
      });
      return {
        // Strip only trailing newline, preserving significant leading spaces (crucial for porcelain status)
        stdout: stdout.replace(/\r\n/g, '\n').replace(/\n+$/, ''),
        stderr: stderr.trim(),
        exitCode: 0
      };
    } catch (error: any) {
      if (options.allowFailure) {
        return {
          stdout: error.stdout ? error.stdout.toString().replace(/\r\n/g, '\n').replace(/\n+$/, '') : '',
          stderr: error.stderr?.toString().trim() ?? (error.message || 'Git command failed'),
          exitCode: error.code ?? 1
        };
      }
      const stderr = error.stderr?.toString().trim() ?? error.message;
      throw new Error(`Git command 'git ${args.join(' ')}' failed (code ${error.code}): ${stderr}`);
    }
  }

  /**
   * Get current branch name (works even in unborn/clean repositories without commits)
   */
  async getCurrentBranch(): Promise<string> {
    const symRes = await this.exec(['symbolic-ref', '--short', 'HEAD'], { allowFailure: true });
    if (symRes.exitCode === 0 && symRes.stdout.trim()) {
      return symRes.stdout.trim();
    }

    const branchRes = await this.exec(['branch', '--show-current'], { allowFailure: true });
    if (branchRes.exitCode === 0 && branchRes.stdout.trim()) {
      return branchRes.stdout.trim();
    }

    const headRes = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true });
    if (headRes.exitCode === 0 && headRes.stdout.trim()) {
      return headRes.stdout.trim();
    }

    return 'HEAD (detached)';
  }

  /**
   * Check if repo is in a merge or rebase state
   */
  async checkMidOperationState(): Promise<{ inMerge: boolean; inRebase: boolean }> {
    const gitDirRes = await this.exec(['rev-parse', '--git-dir'], { allowFailure: true });
    const gitDir = gitDirRes.exitCode === 0 ? path.resolve(this.repoPath, gitDirRes.stdout.trim()) : path.join(this.repoPath, '.git');

    const inMerge = fs.existsSync(path.join(gitDir, 'MERGE_HEAD'));
    const inRebase = fs.existsSync(path.join(gitDir, 'rebase-apply')) || fs.existsSync(path.join(gitDir, 'rebase-merge'));

    return { inMerge, inRebase };
  }

  /**
   * Detailed repository status
   */
  async getStatus(): Promise<GitRepoStatus> {
    const branch = await this.getCurrentBranch();
    const { inMerge, inRebase } = await this.checkMidOperationState();

    const res = await this.exec(['status', '--porcelain=v1', '-uall']);
    const lines = res.stdout ? res.stdout.split('\n') : [];

    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    for (const line of lines) {
      if (!line || line.length < 3) continue;
      const x = line[0];
      const y = line[1];
      const file = line.substring(3).trim();

      // Check conflict markers
      if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
        conflicted.push(file);
      } else if (x === '?' && y === '?') {
        untracked.push(file);
      } else {
        if (x !== ' ' && x !== '?') {
          staged.push(file);
        }
        if (y !== ' ' && y !== '?') {
          modified.push(file);
        }
      }
    }

    const isClean = staged.length === 0 && modified.length === 0 && untracked.length === 0 && conflicted.length === 0;

    return {
      branch,
      isClean,
      staged,
      modified,
      untracked,
      conflicted,
      inMerge,
      inRebase
    };
  }

  /**
   * Creates a shadow commit of the working tree without moving HEAD or touching index.
   * Returns commit SHA or null if working tree is clean.
   */
  async stashCreate(message: string = 'gitwizard-snapshot'): Promise<string | null> {
    const res = await this.exec(['stash', 'create', message], { allowFailure: true });
    if (res.exitCode === 0 && res.stdout.trim()) {
      return res.stdout.trim();
    }
    return null;
  }

  /**
   * Write index to tree object
   */
  async writeTree(): Promise<string> {
    const res = await this.exec(['write-tree']);
    return res.stdout.trim();
  }

  /**
   * Commit a tree directly with custom parents without moving HEAD
   */
  async commitTree(treeSha: string, message: string, parentShas: string[] = []): Promise<string> {
    const args = ['commit-tree', treeSha, '-m', message];
    for (const p of parentShas) {
      args.push('-p', p);
    }
    const res = await this.exec(args);
    return res.stdout.trim();
  }

  /**
   * Update or create a Git ref (e.g. refs/gitwizard/snapshots/<id>)
   */
  async updateRef(ref: string, commitSha: string): Promise<void> {
    await this.exec(['update-ref', ref, commitSha]);
  }

  /**
   * Read the SHA of a specific ref
   */
  async getRef(ref: string): Promise<string | null> {
    const res = await this.exec(['rev-parse', '--verify', ref], { allowFailure: true });
    if (res.exitCode === 0 && res.stdout.trim()) {
      return res.stdout.trim();
    }
    return null;
  }

  /**
   * List all refs matching a prefix
   */
  async listRefs(prefix: string): Promise<RefInfo[]> {
    const res = await this.exec(['for-each-ref', '--format=%(refname) %(objectname)', prefix], { allowFailure: true });
    if (res.exitCode !== 0 || !res.stdout.trim()) {
      return [];
    }
    return res.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [ref, sha] = line.split(' ');
        return { ref, sha };
      });
  }

  /**
   * Delete a ref
   */
  async deleteRef(ref: string): Promise<void> {
    await this.exec(['update-ref', '-d', ref]);
  }

  /**
   * Reset working tree to target SHA or HEAD
   */
  async resetHard(targetSha: string = 'HEAD'): Promise<void> {
    await this.exec(['reset', '--hard', targetSha]);
  }

  /**
   * Abort in-progress merge or rebase
   */
  async abortInProgress(): Promise<void> {
    const { inMerge, inRebase } = await this.checkMidOperationState();
    if (inMerge) {
      await this.exec(['merge', '--abort'], { allowFailure: true });
    }
    if (inRebase) {
      await this.exec(['rebase', '--abort'], { allowFailure: true });
    }
  }
}
