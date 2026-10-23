import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileRewindEngine } from '../../src/pro/file-rewind';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('FileRewindEngine', () => {
  let testRepoPath: string;
  let git: GitClient;
  let snapshotManager: SnapshotManager;
  let engine: FileRewindEngine;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-file-rewind-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Rewind Tester"', { cwd: testRepoPath });
    execSync('git config user.email "rewind@test.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'fileA.txt'), 'version 1 - file A');
    fs.writeFileSync(path.join(testRepoPath, 'fileB.txt'), 'version 1 - file B');
    fs.mkdirSync(path.join(testRepoPath, 'sub folder with space'), { recursive: true });
    fs.writeFileSync(path.join(testRepoPath, 'sub folder with space', 'nested.txt'), 'nested version 1');

    execSync('git add . && git commit -m "chore: initial commit"', { cwd: testRepoPath });

    git = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(git);
    engine = new FileRewindEngine(git, snapshotManager);
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {}
  });

  it('restores single modified file while leaving other modified files intact', async () => {
    // 1. Take a snapshot of initial state
    const snap = await snapshotManager.createSnapshot('clean-state');

    // 2. Modify both fileA and fileB
    fs.writeFileSync(path.join(testRepoPath, 'fileA.txt'), 'version 2 - modified A');
    fs.writeFileSync(path.join(testRepoPath, 'fileB.txt'), 'version 2 - modified B');

    // 3. Surgically rewind ONLY fileA
    const res = await engine.rewindFile(snap.id, 'fileA.txt');
    expect(res.success).toBe(true);

    // 4. fileA should be back to version 1
    const contentA = fs.readFileSync(path.join(testRepoPath, 'fileA.txt'), 'utf-8');
    expect(contentA).toBe('version 1 - file A');

    // 5. fileB should STILL be version 2 (untouched!)
    const contentB = fs.readFileSync(path.join(testRepoPath, 'fileB.txt'), 'utf-8');
    expect(contentB).toBe('version 2 - modified B');
  });

  it('restores a deleted file back from snapshot', async () => {
    const snap = await snapshotManager.createSnapshot('has-fileB');

    // Delete fileB from disk
    fs.unlinkSync(path.join(testRepoPath, 'fileB.txt'));
    expect(fs.existsSync(path.join(testRepoPath, 'fileB.txt'))).toBe(false);

    // Surgically restore fileB
    const res = await engine.rewindFile(snap.id, 'fileB.txt');
    expect(res.success).toBe(true);

    // fileB should exist again with original contents
    expect(fs.existsSync(path.join(testRepoPath, 'fileB.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(testRepoPath, 'fileB.txt'), 'utf-8')).toBe('version 1 - file B');
  });

  it('handles spaces and nested directory paths', async () => {
    const snap = await snapshotManager.createSnapshot('has-nested');

    const nestedPath = path.join(testRepoPath, 'sub folder with space', 'nested.txt');
    fs.writeFileSync(nestedPath, 'nested version 2 - edited');

    const res = await engine.rewindFile(snap.id, 'sub folder with space/nested.txt');
    expect(res.success).toBe(true);

    const restored = fs.readFileSync(nestedPath, 'utf-8');
    expect(restored).toBe('nested version 1');
  });

  it('returns friendly error when file did not exist in target snapshot', async () => {
    const snap = await snapshotManager.createSnapshot('early-snap');

    const res = await engine.rewindFile(snap.id, 'does-not-exist.txt');
    expect(res.success).toBe(false);
    expect(res.error).toContain('did not exist in snapshot');
  });

  it('reads snapshot file content without touching disk', async () => {
    const snap = await snapshotManager.createSnapshot('snap-read');
    fs.writeFileSync(path.join(testRepoPath, 'fileA.txt'), 'new uncommitted data');

    const snapContent = await engine.getSnapshotFileContent(snap.id, 'fileA.txt');
    expect(snapContent).toBe('version 1 - file A');

    // Disk remains unchanged
    expect(fs.readFileSync(path.join(testRepoPath, 'fileA.txt'), 'utf-8')).toBe('new uncommitted data');
  });
});
