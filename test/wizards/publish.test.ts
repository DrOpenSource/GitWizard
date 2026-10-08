import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { TransactionRunner } from '../../src/engine/transaction';
import { RepoSplitterWizard } from '../../src/wizards/publish';

describe('RepoSplitterWizard', () => {
  let sourceRepoPath: string;
  let targetBareRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let runner: TransactionRunner;
  let wizard: RepoSplitterWizard;

  beforeEach(() => {
    // 1. Setup source repository
    sourceRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'source-repo-'));
    execSync('git init -b main', { cwd: sourceRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: sourceRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: sourceRepoPath });

    fs.writeFileSync(path.join(sourceRepoPath, 'main.txt'), 'main content');
    execSync('git add . && git commit -m "init main"', { cwd: sourceRepoPath });

    // Create an experiment branch to be promoted to its own repo
    execSync('git checkout -b feature/experiment', { cwd: sourceRepoPath });
    fs.writeFileSync(path.join(sourceRepoPath, 'standalone_app.ts'), 'export const app = "promoted";');
    execSync('git add . && git commit -m "feat: independent starter app"', { cwd: sourceRepoPath });
    execSync('git checkout main', { cwd: sourceRepoPath });

    // 2. Setup a target bare repository to simulate a new GitHub repo
    targetBareRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'target-bare-'));
    execSync('git init --bare -b main', { cwd: targetBareRepoPath });

    client = new GitClient(sourceRepoPath);
    snapshotManager = new SnapshotManager(client);
    runner = new TransactionRunner(client, snapshotManager);
    wizard = new RepoSplitterWizard(client, snapshotManager, runner);
  });

  afterEach(() => {
    fs.rmSync(sourceRepoPath, { recursive: true, force: true });
    fs.rmSync(targetBareRepoPath, { recursive: true, force: true });
  });

  it('splits and promotes a branch into a new repository as main', async () => {
    const result = await wizard.splitToNewRepo({
      sourceBranch: 'feature/experiment',
      newRepoName: 'promoted-app',
      targetBranch: 'main',
      customRemoteUrl: targetBareRepoPath
    });

    expect(result.success).toBe(true);
    expect(result.targetBranch).toBe('main');

    // Clone target repo into inspection folder to verify it contains the promoted files on main
    const inspectionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'inspect-'));
    execSync(`git clone -b main "${targetBareRepoPath}" .`, { cwd: inspectionPath });

    expect(fs.existsSync(path.join(inspectionPath, 'standalone_app.ts'))).toBe(true);
    const content = fs.readFileSync(path.join(inspectionPath, 'standalone_app.ts'), 'utf-8');
    expect(content).toContain('promoted');

    fs.rmSync(inspectionPath, { recursive: true, force: true });
  });

  it('fails gracefully when source branch does not exist without corrupting repo', async () => {
    await expect(
      wizard.splitToNewRepo({
        sourceBranch: 'non-existent-branch',
        newRepoName: 'fail-repo',
        customRemoteUrl: targetBareRepoPath
      })
    ).rejects.toThrow(/does not exist/);
  });
});
