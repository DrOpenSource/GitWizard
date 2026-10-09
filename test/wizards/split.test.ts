import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { TransactionRunner } from '../../src/engine/transaction';
import { BranchSplitterWizard } from '../../src/wizards/split';

describe('BranchSplitterWizard', () => {
  let testRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let runner: TransactionRunner;
  let wizard: BranchSplitterWizard;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'split-wiz-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'readme.md'), '# Base Project');
    execSync('git add . && git commit -m "init"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(client);
    runner = new TransactionRunner(client, snapshotManager);
    wizard = new BranchSplitterWizard(client, snapshotManager, runner);
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {
      // Windows file handle release grace
    }
  });

  it('splits modified and new files into two clean branches', async () => {
    // Simulate vibe coder creating multiple unrelated files at once
    fs.writeFileSync(path.join(testRepoPath, 'auth.ts'), 'export const auth = true;');
    fs.writeFileSync(path.join(testRepoPath, 'auth-routes.ts'), 'export const routes = [];');
    fs.writeFileSync(path.join(testRepoPath, 'button.tsx'), 'export const Button = () => null;');
    fs.writeFileSync(path.join(testRepoPath, 'styles.css'), '.button { color: blue; }');

    const result = await wizard.splitChanges({
      baseBranch: 'main',
      groups: [
        {
          branchName: 'feature/auth',
          commitMessage: 'feat(auth): add authentication logic and routes',
          files: ['auth.ts', 'auth-routes.ts']
        },
        {
          branchName: 'feature/ui',
          commitMessage: 'feat(ui): add button component and styles',
          files: ['button.tsx', 'styles.css']
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.createdBranches).toEqual(['feature/auth', 'feature/ui']);

    // Verify feature/auth branch contains ONLY auth files
    await client.exec(['checkout', 'feature/auth']);
    expect(fs.existsSync(path.join(testRepoPath, 'auth.ts'))).toBe(true);
    expect(fs.existsSync(path.join(testRepoPath, 'auth-routes.ts'))).toBe(true);
    expect(fs.existsSync(path.join(testRepoPath, 'button.tsx'))).toBe(false);

    // Verify feature/ui branch contains ONLY ui files
    await client.exec(['checkout', 'feature/ui']);
    expect(fs.existsSync(path.join(testRepoPath, 'button.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(testRepoPath, 'styles.css'))).toBe(true);
    expect(fs.existsSync(path.join(testRepoPath, 'auth.ts'))).toBe(false);
  });

  it('rejects split and maintains workspace integrity if branch name exists', async () => {
    // Pre-create branch
    await client.exec(['branch', 'feature/existing']);

    fs.writeFileSync(path.join(testRepoPath, 'temp.ts'), 'content');

    await expect(
      wizard.splitChanges({
        groups: [
          {
            branchName: 'feature/existing',
            commitMessage: 'some commit',
            files: ['temp.ts']
          }
        ]
      })
    ).rejects.toThrow(/already exists/);

    // Verify working file was preserved
    expect(fs.existsSync(path.join(testRepoPath, 'temp.ts'))).toBe(true);
  });
});
