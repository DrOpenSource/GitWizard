import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { TransactionRunner } from '../../src/engine/transaction';

describe('TransactionRunner', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let runner: TransactionRunner;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'feature.txt'), 'original feature');
    execSync('git add . && git commit -m "initial commit"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    runner = new TransactionRunner(client, snapshotManager);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('completes transaction when all steps succeed', async () => {
    const result = await runner.runTransaction('successful-flow', [
      {
        name: 'step-1',
        run: async (git) => {
          fs.writeFileSync(path.join(testRepoPath, 'feature.txt'), 'step 1 changes');
          return 'step 1 ok';
        }
      },
      {
        name: 'step-2',
        run: async (git) => {
          fs.writeFileSync(path.join(testRepoPath, 'new.txt'), 'step 2 file');
          return 'step 2 ok';
        }
      }
    ]);

    expect(result.success).toBe(true);
    expect(result.results).toEqual(['step 1 ok', 'step 2 ok']);
    expect(fs.readFileSync(path.join(testRepoPath, 'feature.txt'), 'utf-8')).toBe('step 1 changes');
  });

  it('rolls back working tree automatically when a step fails mid-transaction', async () => {
    const originalContent = fs.readFileSync(path.join(testRepoPath, 'feature.txt'), 'utf-8');

    const result = await runner.runTransaction('failing-flow', [
      {
        name: 'destructive-step',
        run: async (git) => {
          // Mutate file
          fs.writeFileSync(path.join(testRepoPath, 'feature.txt'), 'MUTATED BY ACCIDENT');
          return 'mutated';
        }
      },
      {
        name: 'failing-step',
        run: async (git) => {
          throw new Error('Simulated network or merge conflict failure');
        }
      }
    ]);

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.error?.message).toContain('Simulated network or merge conflict failure');

    // Verify file was restored to original content!
    const restoredContent = fs.readFileSync(path.join(testRepoPath, 'feature.txt'), 'utf-8');
    expect(restoredContent).toBe(originalContent);
  });
});
