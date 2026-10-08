import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { CheckpointWizard } from '../../src/wizards/checkpoint';

describe('CheckpointWizard', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let wizard: CheckpointWizard;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-wiz-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'app.ts'), 'console.log("v1");');
    execSync('git add . && git commit -m "init"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    wizard = new CheckpointWizard(client, snapshotManager);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('saves checkpoints and lists them in order', async () => {
    const snap1 = await wizard.saveCheckpoint('before-experiment');
    expect(snap1.label).toBe('before-experiment');

    const list = await wizard.listCheckpoints();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBe(snap1.id);
  });

  it('restores checkpoint and takes pre-restore backup', async () => {
    const snap = await wizard.saveCheckpoint('good-state');

    // Corrupt file
    fs.writeFileSync(path.join(testRepoPath, 'app.ts'), 'BROKEN CODE');

    // Restore
    await wizard.restoreCheckpoint(snap.id);

    // Verify restored
    expect(fs.readFileSync(path.join(testRepoPath, 'app.ts'), 'utf-8')).toBe('console.log("v1");');

    // Verify pre-restore-backup was created
    const list = await wizard.listCheckpoints();
    const backup = list.find(s => s.label === 'pre-restore-backup');
    expect(backup).toBeDefined();
  });

  it('computes diff files against a checkpoint', async () => {
    const snap = await wizard.saveCheckpoint('baseline');

    fs.writeFileSync(path.join(testRepoPath, 'app.ts'), 'console.log("v2");');
    fs.writeFileSync(path.join(testRepoPath, 'new-file.ts'), 'export const x = 1;');

    const diff = await wizard.getDiffWithCurrent(snap.id);
    expect(diff.length).toBeGreaterThanOrEqual(1);
    expect(diff.map(d => d.path)).toContain('app.ts');
  });
});
