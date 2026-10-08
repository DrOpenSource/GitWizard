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
});
