import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';

describe('SnapshotManager', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'initial content');
    execSync('git add . && git commit -m "initial commit"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('creates snapshot and stores metadata without moving HEAD', async () => {
    const headBefore = (await client.exec(['rev-parse', 'HEAD'])).stdout;

    // Modify a file and create an untracked file
    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'modified content');
    fs.writeFileSync(path.join(testRepoPath, 'new_untracked.txt'), 'untracked content');

    const snapshot = await snapshotManager.createSnapshot('test-checkpoint');
    expect(snapshot.id).toBeDefined();
    expect(snapshot.label).toBe('test-checkpoint');

    // Verify HEAD was NOT moved
    const headAfter = (await client.exec(['rev-parse', 'HEAD'])).stdout;
    expect(headAfter).toBe(headBefore);

    // Verify snapshot ref exists
    const refSha = await client.getRef(`refs/gitwizard/snapshots/${snapshot.id}`);
    expect(refSha).toBe(snapshot.snapshotSha);

    // Verify listed snapshots
    const snapshots = await snapshotManager.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    expect(snapshots[0].id).toBe(snapshot.id);
  });

  it('restores working tree to snapshot state cleanly', async () => {
    // Initial state: 'initial content'
    const snapshot = await snapshotManager.createSnapshot('baseline');

    // Simulate accidental disaster / overwrites
    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'RUINED CONTENT');
    expect(fs.readFileSync(path.join(testRepoPath, 'initial.txt'), 'utf-8')).toBe('RUINED CONTENT');

    // Restore snapshot
    await snapshotManager.restoreSnapshot(snapshot.id);

    // Verify file content is restored
    expect(fs.readFileSync(path.join(testRepoPath, 'initial.txt'), 'utf-8')).toBe('initial content');
  });
});
