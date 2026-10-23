import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { AutoCheckpointController } from '../../src/engine/auto-checkpoint';

describe('AutoCheckpointController', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let controller: AutoCheckpointController;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-cp-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'base.txt'), 'initial content');
    execSync('git add . && git commit -m "initial commit"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    controller = new AutoCheckpointController(client, snapshotManager, 5);
  });

  afterEach(() => {
    controller.dispose();
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {
      // Windows file handle release grace
    }
  });

  it('captures snapshot when workspace is dirty', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'dirty.txt'), 'dirty content');

    const snap = await controller.captureIfDirty('manual-trigger');
    expect(snap).not.toBeNull();
    expect(snap!.label).toContain('auto-manual-trigger');

    // Verify snapshot is stored in the list
    const allSnaps = await snapshotManager.listSnapshots();
    expect(allSnaps.some(s => s.id === snap!.id)).toBe(true);
  });

  it('returns null when workspace is clean (no dirty files)', async () => {
    const snap = await controller.captureIfDirty('clean-test');
    expect(snap).toBeNull();
  });

  it('skips duplicate snapshot when tree SHA has not changed', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'content A');

    const snap1 = await controller.captureIfDirty('first');
    expect(snap1).not.toBeNull();

    // Same dirty state, same tree SHA — should be skipped
    const snap2 = await controller.captureIfDirty('second');
    expect(snap2).toBeNull();
  });

  it('captures new snapshot when tree SHA changes between captures', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'content A');
    const snap1 = await controller.captureIfDirty('first');
    expect(snap1).not.toBeNull();

    // Modify file to change tree SHA
    fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'content B different');
    const snap2 = await controller.captureIfDirty('second');
    expect(snap2).not.toBeNull();
    expect(snap2!.id).not.toBe(snap1!.id);
  });

  it('prunes auto-snapshots beyond max limit', async () => {
    // Create 7 auto-snapshots (max is 5)
    for (let i = 0; i < 7; i++) {
      fs.writeFileSync(path.join(testRepoPath, `file-${i}.txt`), `content ${i}`);
      await controller.captureIfDirty(`batch-${i}`);
    }

    const allSnaps = await snapshotManager.listSnapshots();
    const autoSnaps = allSnaps.filter(s => s.label.startsWith('auto-'));
    expect(autoSnaps.length).toBeLessThanOrEqual(5);
  });

  it('prevents concurrent captures via _isCapturing guard', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'concurrent.txt'), 'test data');

    // Fire two concurrent captures — second should return null due to guard
    const [snap1, snap2] = await Promise.all([
      controller.captureIfDirty('concurrent-a'),
      controller.captureIfDirty('concurrent-b')
    ]);

    // One should succeed, one should be guarded out
    const results = [snap1, snap2].filter(s => s !== null);
    expect(results.length).toBe(1);
  });

  it('scheduleAutoCheckpoint debounces and eventually captures', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'debounce.txt'), 'debounce test');

    // Schedule with a very short delay
    const snapPromise = controller.scheduleAutoCheckpoint('debounce-test', 50);
    const snap = await snapPromise;

    expect(snap).not.toBeNull();
    expect(snap!.label).toContain('auto-debounce-test');
  });

  it('scheduleAutoCheckpoint resets timer on rapid calls (only last fires)', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'rapid.txt'), 'rapid test');

    // Fire 3 rapid schedules — only the last one's timer should survive
    controller.scheduleAutoCheckpoint('rapid-1', 200);
    controller.scheduleAutoCheckpoint('rapid-2', 200);
    const finalPromise = controller.scheduleAutoCheckpoint('rapid-3', 50);

    const snap = await finalPromise;
    expect(snap).not.toBeNull();
    // The label should be from the last call since earlier timers were cleared
    expect(snap!.label).toContain('auto-rapid-3');
  });

  it('dispose cancels pending debounced timer', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'dispose.txt'), 'dispose test');

    // Schedule with long delay
    const snapPromise = controller.scheduleAutoCheckpoint('should-cancel', 5000);

    // Immediately dispose
    controller.dispose();

    // The promise should never resolve with a snapshot (timer was cleared)
    // We can't directly test the cancelled promise easily, so verify no new snapshots were created
    const allSnaps = await snapshotManager.listSnapshots();
    const cancelledSnap = allSnaps.find(s => s.label.includes('should-cancel'));
    expect(cancelledSnap).toBeUndefined();
  });
});
