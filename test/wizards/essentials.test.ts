import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { DailyEssentialsWizard } from '../../src/wizards/essentials';
import { AutoCheckpointController } from '../../src/engine/auto-checkpoint';

describe('DailyEssentialsWizard & AutoCheckpointController', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let essentials: DailyEssentialsWizard;
  let autoController: AutoCheckpointController;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ess-wiz-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'hello.txt'), 'version 1');
    execSync('git add . && git commit -m "initial commit"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    essentials = new DailyEssentialsWizard(client, snapshotManager);
    autoController = new AutoCheckpointController(client, snapshotManager, 5);
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {
      // Windows file handle release grace
    }
  });

  it('safely commits modified files with automatic safety snapshot', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'hello.txt'), 'version 2 modified');
    fs.writeFileSync(path.join(testRepoPath, 'newfile.txt'), 'new content');

    const res = await essentials.safeCommit('feat: updated hello and added newfile');
    expect(res.success).toBe(true);
    expect(res.message).toContain('Safely saved commit');

    const status = await client.getStatus();
    expect(status.isClean).toBe(true);

    // Verify pre-commit safety snapshot was created
    const snaps = await snapshotManager.listSnapshots();
    expect(snaps.some(s => s.label === 'pre-commit-safety')).toBe(true);
  });

  it('safely uncommits without losing modified files (soft reset)', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'feature.txt'), 'feature code');
    await essentials.safeCommit('feat: added feature');

    // Uncommit
    const uncommitRes = await essentials.safeUncommit();
    expect(uncommitRes.success).toBe(true);

    // Working directory file still exists intact!
    expect(fs.existsSync(path.join(testRepoPath, 'feature.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(testRepoPath, 'feature.txt'), 'utf-8')).toBe('feature code');

    // Repo is now dirty because changes are uncommitted
    const status = await client.getStatus();
    expect(status.isClean).toBe(false);
  });

  it('safely creates and switches branches', async () => {
    const branchRes = await essentials.createBranch('feature/magic-ui');
    expect(branchRes.success).toBe(true);

    let current = await client.getCurrentBranch();
    expect(current).toBe('feature/magic-ui');

    await essentials.switchBranch('main');
    current = await client.getCurrentBranch();
    expect(current).toBe('main');
  });

  it('auto-checkpoint silently captures dirty states without moving HEAD', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'ai-edit.txt'), 'AI generated code');

    const snap = await autoController.captureIfDirty('test-prompt');
    expect(snap).not.toBeNull();
    expect(snap?.label).toContain('auto-test-prompt');

    // HEAD did not move, still on initial commit
    const headRes = await client.exec(['rev-parse', '--short', 'HEAD']);
    expect(headRes.exitCode).toBe(0);

    // Snapshot is listed
    const snaps = await snapshotManager.listSnapshots();
    expect(snaps.some(s => s.id === snap?.id)).toBe(true);
  });

  it('safely pushes commits to remote with upstream tracking', async () => {
    // Setup bare remote
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ess-remote-'));
    try {
      execSync('git init --bare -b main', { cwd: remoteDir });
      execSync(`git remote add origin "${remoteDir}"`, { cwd: testRepoPath });

      // Add a commit
      fs.writeFileSync(path.join(testRepoPath, 'push-test.txt'), 'push content');
      execSync('git add . && git commit -m "commit for push"', { cwd: testRepoPath });

      const pushRes = await essentials.safePush('origin');
      expect(pushRes.success).toBe(true);
      expect(pushRes.message).toContain('successfully');
    } finally {
      fs.rmSync(remoteDir, { recursive: true, force: true });
    }
  });

  it('safely pulls updates from remote', async () => {
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ess-remote-pull-'));
    const peerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ess-peer-'));
    try {
      execSync('git init --bare -b main', { cwd: remoteDir });
      execSync(`git remote add origin "${remoteDir}"`, { cwd: testRepoPath });
      execSync('git push -u origin main', { cwd: testRepoPath });

      // Peer repo clones and pushes a change
      execSync(`git clone -b main "${remoteDir}" .`, { cwd: peerDir });
      execSync('git config user.name "Peer"', { cwd: peerDir });
      execSync('git config user.email "peer@example.com"', { cwd: peerDir });
      fs.writeFileSync(path.join(peerDir, 'peer-update.txt'), 'peer content');
      execSync('git add . && git commit -m "peer commit" && git push origin main', { cwd: peerDir });

      // Local safe pull
      const pullRes = await essentials.safePull('origin');
      expect(pullRes.success).toBe(true);
      expect(fs.existsSync(path.join(testRepoPath, 'peer-update.txt'))).toBe(true);
    } finally {
      fs.rmSync(peerDir, { recursive: true, force: true });
      fs.rmSync(remoteDir, { recursive: true, force: true });
    }
  });

  it('returns failure message when switching to non-existent branch', async () => {
    const res = await essentials.switchBranch('non-existent-branch-xyz');
    expect(res.success).toBe(false);
    expect(res.message).toContain("Failed to switch to 'non-existent-branch-xyz'");
  });
});

