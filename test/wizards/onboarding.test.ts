import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { DailyEssentialsWizard } from '../../src/wizards/essentials';

describe('Phase 1: Zero-Friction Onboarding & Untracked State Airbag', () => {
  let tempDirPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let essentials: DailyEssentialsWizard;

  beforeEach(() => {
    // Pure empty directory without git init
    tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-test-'));
    client = new GitClient(tempDirPath);
    snapshotManager = new SnapshotManager(client);
    essentials = new DailyEssentialsWizard(client, snapshotManager);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDirPath, { recursive: true, force: true });
    } catch {
      // Windows file lock grace
    }
  });

  it('correctly detects uninitialized directory without throwing exceptions', async () => {
    const isInside = await client.isRepo();
    expect(isInside).toBe(false);

    const status = await client.getStatus();
    expect(status.isRepo).toBe(false);
    expect(status.isClean).toBe(true);
    expect(status.branch).toBe('');
    expect(status.staged).toHaveLength(0);
    expect(status.modified).toHaveLength(0);
    expect(status.untracked).toHaveLength(0);
  });

  it('intercepts commit attempts on uninitialized repo and guides user to enable safe mode', async () => {
    fs.writeFileSync(path.join(tempDirPath, 'app.tsx'), 'const App = () => <div>Hello</div>;');

    const res = await essentials.safeCommit('feat: initial app');
    expect(res.success).toBe(false);
    expect(res.needsInit).toBe(true);
    expect(res.message).toContain('Please enable Safe Mode first');
  });

  it('1-click initRepo transforms untracked directory into a protected Git repository', async () => {
    fs.writeFileSync(path.join(tempDirPath, 'index.html'), '<h1>My Project</h1>');

    const initRes = await client.initRepo('main');
    expect(initRes.exitCode).toBe(0);

    const isInside = await client.isRepo();
    expect(isInside).toBe(true);

    const status = await client.getStatus();
    expect(status.isRepo).toBe(true);
    expect(status.branch).toBe('main');
    expect(status.untracked).toContain('index.html');
  });

  it('self-heals missing author identity using provided author credentials', async () => {
    await client.initRepo('main');
    fs.writeFileSync(path.join(tempDirPath, 'index.js'), 'console.log("hello");');

    // Commit with in-app author credentials
    const commitRes = await essentials.safeCommit('feat: initial code', {
      authorName: 'Alex VibeCoder',
      authorEmail: 'alex@example.com'
    });

    expect(commitRes.success).toBe(true);
    expect(commitRes.message).toContain('Safely saved commit');

    // Verify local author identity was persisted in .git/config
    const identity = await client.getAuthorIdentity();
    expect(identity.name).toBe('Alex VibeCoder');
    expect(identity.email).toBe('alex@example.com');
    expect(identity.isComplete).toBe(true);

    // Subsequent commits succeed automatically without re-prompting
    fs.writeFileSync(path.join(tempDirPath, 'index.js'), 'console.log("updated");');
    const secondCommitRes = await essentials.safeCommit('fix: update console');
    expect(secondCommitRes.success).toBe(true);
  });

  it('prompts for author identity when git identity is completely unset', async () => {
    await client.initRepo('main');
    fs.writeFileSync(path.join(tempDirPath, 'index.js'), 'console.log("hello");');

    // Create a mock Git client with empty config response to simulate unset global/local git identity
    const emptyClient = new GitClient(tempDirPath);
    emptyClient.getAuthorIdentity = async () => ({
      name: undefined,
      email: undefined,
      isComplete: false
    });

    const emptyEssentials = new DailyEssentialsWizard(emptyClient, snapshotManager);
    const res = await emptyEssentials.safeCommit('feat: no identity');

    expect(res.success).toBe(false);
    expect(res.requiresIdentity).toBe(true);
    expect(res.message).toContain('Git requires a display name and email');
  });
});

