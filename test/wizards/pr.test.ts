import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { PullRequestWizard } from '../../src/wizards/pr';

describe('PullRequestWizard', () => {
  let localRepoPath: string;
  let remoteBareRepoPath: string;
  let client: GitClient;
  let prWizard: PullRequestWizard;

  beforeEach(() => {
    // 1. Create a bare remote
    remoteBareRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-remote-bare-'));
    execSync('git init --bare', { cwd: remoteBareRepoPath });

    // 2. Create local repo
    localRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-local-repo-'));
    execSync('git init -b main', { cwd: localRepoPath });
    execSync('git config user.name "PR Tester"', { cwd: localRepoPath });
    execSync('git config user.email "pr@test.com"', { cwd: localRepoPath });

    // Initial commit
    fs.writeFileSync(path.join(localRepoPath, 'README.md'), '# Main Repo');
    execSync('git add . && git commit -m "initial commit"', { cwd: localRepoPath });

    // Set remote origin to a realistic GitHub URL for URL parsing
    execSync(`git remote add origin https://github.com/DrOpenSource/GitWizard.git`, { cwd: localRepoPath });

    client = new GitClient(localRepoPath);
    prWizard = new PullRequestWizard(client);
  });

  afterEach(() => {
    fs.rmSync(localRepoPath, { recursive: true, force: true });
    fs.rmSync(remoteBareRepoPath, { recursive: true, force: true });
  });

  describe('parseGitHubRemote', () => {
    it('accurately parses HTTPS remote URLs with and without .git', () => {
      const parsed1 = PullRequestWizard.parseGitHubRemote('https://github.com/DrOpenSource/GitWizard.git');
      expect(parsed1).toEqual({ owner: 'DrOpenSource', repo: 'GitWizard' });

      const parsed2 = PullRequestWizard.parseGitHubRemote('https://github.com/acme-corp/web-app');
      expect(parsed2).toEqual({ owner: 'acme-corp', repo: 'web-app' });
    });

    it('accurately parses SSH remote URLs', () => {
      const parsed1 = PullRequestWizard.parseGitHubRemote('git@github.com:DrOpenSource/GitWizard.git');
      expect(parsed1).toEqual({ owner: 'DrOpenSource', repo: 'GitWizard' });

      const parsed2 = PullRequestWizard.parseGitHubRemote('ssh://git@github.com/org-team/project.git');
      expect(parsed2).toEqual({ owner: 'org-team', repo: 'project' });
    });

    it('returns null on invalid or non-GitHub URLs', () => {
      expect(PullRequestWizard.parseGitHubRemote('')).toBeNull();
      expect(PullRequestWizard.parseGitHubRemote('https://gitlab.com/user/repo.git')).toBeNull();
      expect(PullRequestWizard.parseGitHubRemote('not-a-url')).toBeNull();
    });
  });

  describe('getCompareWebUrl', () => {
    it('constructs fully encoded GitHub comparison URL with prefilled title and body', () => {
      const url = PullRequestWizard.getCompareWebUrl({
        owner: 'DrOpenSource',
        repo: 'GitWizard',
        baseBranch: 'main',
        headBranch: 'feature/auth-login',
        title: 'feat(auth): add login form',
        body: 'Implemented OAuth2 & JWT tokens'
      });

      expect(url).toContain('https://github.com/DrOpenSource/GitWizard/compare/main...feature/auth-login?');
      expect(url).toContain('expand=1');
      expect(url).toContain('title=feat%28auth%29%3A+add+login+form');
      expect(url).toContain('body=Implemented+OAuth2+%26+JWT+tokens');
    });
  });

  describe('createPullRequest', () => {
    it('throws error when trying to create a PR into the same branch (e.g. main into main)', async () => {
      await expect(
        prWizard.createPullRequest({ headBranch: 'main', baseBranch: 'main' })
      ).rejects.toThrow(/Cannot create Pull Request from 'main' into itself/);
    });

    it('throws error when remote origin does not exist', async () => {
      execSync('git remote remove origin', { cwd: localRepoPath });
      await expect(
        prWizard.createPullRequest({ headBranch: 'feature/billing', baseBranch: 'main', autoPush: false })
      ).rejects.toThrow(/No remote 'origin' found/);
    });

    it('generates a web fallback URL with pre-filled title and body when gh CLI is unavailable', async () => {
      // Mock isGhCliAvailable to return false
      prWizard.isGhCliAvailable = async () => false;

      // Create a feature branch
      execSync('git checkout -b feature/stripe-billing', { cwd: localRepoPath });
      fs.writeFileSync(path.join(localRepoPath, 'billing.ts'), 'export const stripe = true;');
      execSync('git add . && git commit -m "feat(billing): add stripe"', { cwd: localRepoPath });

      const result = await prWizard.createPullRequest({
        baseBranch: 'main',
        title: 'feat(billing): integrate stripe checkout',
        body: 'Added checkout endpoints and webhooks',
        autoPush: false // skip push against mock URL
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('web');
      expect(result.headBranch).toBe('feature/stripe-billing');
      expect(result.baseBranch).toBe('main');
      expect(result.title).toBe('feat(billing): integrate stripe checkout');
      expect(result.prUrl).toContain('https://github.com/DrOpenSource/GitWizard/compare/main...feature/stripe-billing?');
      expect(result.prUrl).toContain('expand=1');
    });

    it('provides smart fallback title and body if none provided', async () => {
      prWizard.isGhCliAvailable = async () => false;

      execSync('git checkout -b feature/dark-mode', { cwd: localRepoPath });

      const result = await prWizard.createPullRequest({
        baseBranch: 'main',
        autoPush: false
      });

      expect(result.success).toBe(true);
      expect(result.title).toBe('feat(feature/dark-mode): updates from feature/dark-mode');
      expect(result.body).toContain('Pull Request Summary');
    });
  });
});

