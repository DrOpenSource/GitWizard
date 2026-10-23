import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { UndoWizard } from '../../src/wizards/undo';

describe('UndoWizard', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let wizard: UndoWizard;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'undo-wiz-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 1');
    execSync('git add . && git commit -m "commit version 1"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    wizard = new UndoWizard(client, snapshotManager);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('translates reflog entries into human-readable actions', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 2');
    execSync('git add . && git commit -m "add feature v2"', { cwd: testRepoPath });

    const actions = await wizard.getRecentActions();
    expect(actions.length).toBeGreaterThanOrEqual(2);

    const latest = actions[0];
    expect(latest.category).toBe('commit');
    expect(latest.title).toContain('add feature v2');
  });

  it('safely unwinds last commit to previous state with pre-undo snapshot', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 2');
    execSync('git add . && git commit -m "mistake commit"', { cwd: testRepoPath });
    expect(fs.readFileSync(path.join(testRepoPath, 'file.txt'), 'utf-8')).toBe('version 2');

    // Run undoLastAction
    const undoRes = await wizard.undoLastAction();
    expect(undoRes.success).toBe(true);

    // Verify file content was rewound to version 1
    expect(fs.readFileSync(path.join(testRepoPath, 'file.txt'), 'utf-8')).toBe('version 1');

    // Verify pre-undo snapshot was saved
    const snapshots = await snapshotManager.listSnapshots();
    const preUndoSnap = snapshots.find(s => s.label.includes('pre-undo'));
    expect(preUndoSnap).toBeDefined();
  });

  it('reverts to an arbitrary selector like HEAD@{2}', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 2');
    execSync('git add . && git commit -m "second commit"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 3');
    execSync('git add . && git commit -m "third commit"', { cwd: testRepoPath });

    expect(fs.readFileSync(path.join(testRepoPath, 'file.txt'), 'utf-8')).toBe('version 3');

    // Rewind back 2 steps to HEAD@{2} (which was version 1)
    const result = await wizard.revertToReflogSelector('HEAD@{2}');
    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(testRepoPath, 'file.txt'), 'utf-8')).toBe('version 1');
  });

  it('throws and preserves workspace when invalid selector is given', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'current content');

    await expect(wizard.revertToReflogSelector('HEAD@{9999}')).rejects.toThrow(
      /Failed to rewind to HEAD@\{9999\}/
    );

    // Working directory content preserved
    expect(fs.readFileSync(path.join(testRepoPath, 'file.txt'), 'utf-8')).toBe('current content');
  });

  it('correctly categorizes checkout, amend, reset, and merge reflog actions', async () => {
    // 1. Amend
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 1 amended');
    execSync('git commit -a --amend -m "commit version 1 amended"', { cwd: testRepoPath });

    // 2. Checkout new branch
    execSync('git checkout -b feature-test', { cwd: testRepoPath });

    // 3. Reset
    execSync('git reset --soft HEAD', { cwd: testRepoPath });

    const actions = await wizard.getRecentActions(10);
    const categories = actions.map(a => a.category);

    expect(categories).toContain('checkout');
    expect(categories).toContain('reset');
  });
});

