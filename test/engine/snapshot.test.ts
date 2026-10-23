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

  it('deletes snapshot ref and metadata file completely', async () => {
    const snap = await snapshotManager.createSnapshot('to-delete');
    const refBefore = await client.getRef(`refs/gitwizard/snapshots/${snap.id}`);
    expect(refBefore).toBe(snap.snapshotSha);

    const metaFile = path.join(snapshotManager.metadataDir, `${snap.id}.json`);
    expect(fs.existsSync(metaFile)).toBe(true);

    await snapshotManager.deleteSnapshot(snap.id);

    const refAfter = await client.getRef(`refs/gitwizard/snapshots/${snap.id}`);
    expect(refAfter).toBeNull();
    expect(fs.existsSync(metaFile)).toBe(false);

    const list = await snapshotManager.listSnapshots();
    expect(list.some(s => s.id === snap.id)).toBe(false);
  });

  it('lists snapshots strictly ordered by descending timestamp', async () => {
    const snap1 = await snapshotManager.createSnapshot('first');
    // slight sleep to ensure different timestamp
    await new Promise(r => setTimeout(r, 20));
    const snap2 = await snapshotManager.createSnapshot('second');
    await new Promise(r => setTimeout(r, 20));
    const snap3 = await snapshotManager.createSnapshot('third');

    const snapshots = await snapshotManager.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(3);
    const ids = snapshots.map(s => s.id);
    expect(ids.indexOf(snap3.id)).toBeLessThan(ids.indexOf(snap2.id));
    expect(ids.indexOf(snap2.id)).toBeLessThan(ids.indexOf(snap1.id));
  });

  it('computes working tree SHA without modifying git index', async () => {
    // Unstaged change
    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'changed-untracked-unstaged');
    const treeSha = await snapshotManager.getWorkingTreeSha();
    expect(treeSha).toBeTruthy();

    // Verify git status index is still clean / not staged
    const status = await client.getStatus();
    expect(status.staged).toHaveLength(0);
    expect(status.modified).toContain('initial.txt');
  });
});

