import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { DailyEssentialsWizard } from '../../src/wizards/essentials';
import { RepoSplitterWizard } from '../../src/wizards/publish';
import { TransactionRunner } from '../../src/engine/transaction';

describe('Phase 4: Remote Sync & GitHub Onboarding Guard', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let essentialsWizard: DailyEssentialsWizard;
  let splitterWizard: RepoSplitterWizard;
  let runner: TransactionRunner;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-guard-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'readme.md'), '# Test Project');
    execSync('git add . && git commit -m "initial commit"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    runner = new TransactionRunner(client, snapshotManager);
    essentialsWizard = new DailyEssentialsWizard(client, snapshotManager);
    splitterWizard = new RepoSplitterWizard(client, snapshotManager, runner);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  describe('Missing Remote Origin Guard', () => {
    it('detects when origin remote is not configured', async () => {
      const hasOrigin = await essentialsWizard.hasRemote('origin');
      expect(hasOrigin).toBe(false);
    });

    it('safePush intercepts missing remote and returns requiresRemote: true without crash', async () => {
      const res = await essentialsWizard.safePush('origin');
      expect(res.success).toBe(false);
      expect(res.requiresRemote).toBe(true);
      expect(res.message).toContain('Remote \'origin\' is not configured yet');
    });

    it('safePull intercepts missing remote and returns requiresRemote: true without crash', async () => {
      const res = await essentialsWizard.safePull('origin');
      expect(res.success).toBe(false);
      expect(res.requiresRemote).toBe(true);
      expect(res.message).toContain('Remote \'origin\' is not configured yet');
    });

    it('setRemoteUrl successfully configures origin repository URL', async () => {
      const setRes = await essentialsWizard.setRemoteUrl('https://github.com/test-org/my-app.git', 'origin');
      expect(setRes.success).toBe(true);

      const hasOrigin = await essentialsWizard.hasRemote('origin');
      expect(hasOrigin).toBe(true);

      // Verify Git remote output directly
      const remotes = await client.exec(['remote', '-v']);
      expect(remotes.stdout).toContain('https://github.com/test-org/my-app.git');
    });
  });

  describe('Standalone Repo Split Graceful Fallback', () => {
    it('generates properly formatted GitHub web fallback URL', () => {
      const fallback = splitterWizard.getWebFallbackUrl('my-vibe-project', 'An awesome vibe-coded web app');
      expect(fallback).toContain('https://github.com/new?');
      expect(fallback).toContain('name=my-vibe-project');
      expect(fallback).toContain('description=An+awesome+vibe-coded+web+app');
    });

    it('gracefully handles missing gh CLI and returns webFallbackUrl', async () => {
      // Mock isGhCliAvailable to return false
      splitterWizard.isGhCliAvailable = async () => false;

      const res = await splitterWizard.splitToNewRepo({
        sourceBranch: 'main',
        newRepoName: 'standalone-app',
        description: 'Promoted branch'
      });

      expect(res.success).toBe(false);
      expect(res.missingGhCli).toBe(true);
      expect(res.webFallbackUrl).toBeDefined();
      expect(res.webFallbackUrl).toContain('standalone-app');
      expect(res.message).toContain('GitHub CLI (gh) was not detected');
    });
  });
});

