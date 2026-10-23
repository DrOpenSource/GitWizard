import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductionBranchGuard } from '../../src/pro/branch-guard';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { execSync } from 'node:child_process';

describe('ProductionBranchGuard', () => {
  let testRepoPath: string;
  let git: GitClient;
  let snapshotManager: SnapshotManager;
  let guard: ProductionBranchGuard;

  beforeEach(async () => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-guard-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Guard Tester"', { cwd: testRepoPath });
    execSync('git config user.email "guard@test.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Initial Repo');
    execSync('git add . && git commit -m "chore: initial commit"', { cwd: testRepoPath });

    git = new GitClient(testRepoPath);
    snapshotManager = new SnapshotManager(git);
    guard = new ProductionBranchGuard(git, snapshotManager);
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {}
  });

  it('correctly identifies protected branches', () => {
    expect(guard.isBranchProtected('main')).toBe(true);
    expect(guard.isBranchProtected('master')).toBe(true);
    expect(guard.isBranchProtected('production')).toBe(true);
    expect(guard.isBranchProtected('release/v1.2.0')).toBe(true);
    expect(guard.isBranchProtected('feature/auth')).toBe(false);
    expect(guard.isBranchProtected('fix/button-color')).toBe(false);
  });

  it('intercepts actions on main and suggests a feature branch', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'login.ts'), 'export const login = () => {};');

    const evalRes = await guard.evaluateAction('commit');
    expect(evalRes.isProtected).toBe(true);
    expect(evalRes.allowed).toBe(false);
    expect(evalRes.branch).toBe('main');
    expect(evalRes.suggestedFeatureBranch).toContain('feature/login-edits');
  });

  it('allows actions on un-protected feature branches', async () => {
    await git.exec(['checkout', '-b', 'feature/login']);
    fs.writeFileSync(path.join(testRepoPath, 'login.ts'), 'export const login = () => {};');

    const evalRes = await guard.evaluateAction('commit');
    expect(evalRes.isProtected).toBe(false);
    expect(evalRes.allowed).toBe(true);
    expect(evalRes.branch).toBe('feature/login');
  });

  it('relocates uncommitted changes safely to a new feature branch with snapshot', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'feature.ts'), 'console.log("new vibe feature");');

    const relocateRes = await guard.relocateToFeatureBranch('feature/vibe-feature');
    expect(relocateRes.success).toBe(true);
    expect(relocateRes.newBranch).toBe('feature/vibe-feature');

    // Current branch should now be feature/vibe-feature
    const currentStatus = await git.getStatus();
    expect(currentStatus.branch).toBe('feature/vibe-feature');
    expect(currentStatus.untracked).toContain('feature.ts');

    // Verify snapshot was created before relocation
    const snaps = await snapshotManager.listSnapshots();
    expect(snaps.some(s => s.label.includes('pre-guard-relocate-main'))).toBe(true);
  });
});
