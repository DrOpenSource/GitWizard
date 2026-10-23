import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';

describe('GitClient', () => {
  let testRepoPath: string;
  let client: GitClient;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-client-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    client = new GitClient(testRepoPath);
  });

  afterEach(() => {
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('correctly reports status on a new clean repo', async () => {
    const status = await client.getStatus();
    expect(status.branch).toBe('main');
    expect(status.isClean).toBe(true);
    expect(status.modified).toHaveLength(0);
    expect(status.untracked).toHaveLength(0);
  });

  it('detects untracked and modified files', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'hello.txt'), 'hello world');
    const status1 = await client.getStatus();
    expect(status1.isClean).toBe(false);
    expect(status1.untracked).toContain('hello.txt');

    await client.exec(['add', 'hello.txt']);
    await client.exec(['commit', '-m', 'initial commit']);

    fs.writeFileSync(path.join(testRepoPath, 'hello.txt'), 'hello updated');
    const status2 = await client.getStatus();
    expect(status2.isClean).toBe(false);
    expect(status2.modified).toContain('hello.txt');
  });

  it('writes tree and updates refs', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'file1.txt'), 'contents 1');
    await client.exec(['add', 'file1.txt']);
    await client.exec(['commit', '-m', 'commit 1']);

    fs.writeFileSync(path.join(testRepoPath, 'file2.txt'), 'contents 2');
    await client.exec(['add', 'file2.txt']);

    const treeSha = await client.writeTree();
    expect(treeSha).toMatch(/^[0-9a-f]{40}$/);

    const commitSha = await client.commitTree(treeSha, 'shadow commit');
    expect(commitSha).toMatch(/^[0-9a-f]{40}$/);

    await client.updateRef('refs/gitwizard/snapshots/test-snap', commitSha);
    const readSha = await client.getRef('refs/gitwizard/snapshots/test-snap');
    expect(readSha).toBe(commitSha);

    const refs = await client.listRefs('refs/gitwizard/snapshots/');
    expect(refs).toHaveLength(1);
    expect(refs[0].ref).toBe('refs/gitwizard/snapshots/test-snap');
  });

  it('deleteRef removes a previously created ref', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'del.txt'), 'delete me');
    await client.exec(['add', 'del.txt']);
    await client.exec(['commit', '-m', 'commit for ref']);

    const treeSha = await client.writeTree();
    const commitSha = await client.commitTree(treeSha, 'shadow');
    await client.updateRef('refs/gitwizard/snapshots/to-delete', commitSha);

    // Verify ref exists
    expect(await client.getRef('refs/gitwizard/snapshots/to-delete')).toBe(commitSha);

    // Delete it
    await client.deleteRef('refs/gitwizard/snapshots/to-delete');

    // Verify ref is gone
    expect(await client.getRef('refs/gitwizard/snapshots/to-delete')).toBeNull();
  });

  it('resetHard restores working tree to a specific commit', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'reset.txt'), 'version 1');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'v1']);
    const v1Head = (await client.exec(['rev-parse', 'HEAD'])).stdout.trim();

    fs.writeFileSync(path.join(testRepoPath, 'reset.txt'), 'version 2');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'v2']);

    // Reset back to v1
    await client.resetHard(v1Head);

    expect(fs.readFileSync(path.join(testRepoPath, 'reset.txt'), 'utf-8')).toBe('version 1');
    const currentHead = (await client.exec(['rev-parse', 'HEAD'])).stdout.trim();
    expect(currentHead).toBe(v1Head);
  });

  it('abortInProgress aborts an active merge state', async () => {
    // Setup: create two branches with conflicting changes
    fs.writeFileSync(path.join(testRepoPath, 'conflict.txt'), 'base');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'base']);

    await client.exec(['checkout', '-b', 'branch-a']);
    fs.writeFileSync(path.join(testRepoPath, 'conflict.txt'), 'branch A edit');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'branch A']);

    await client.exec(['checkout', 'main']);
    fs.writeFileSync(path.join(testRepoPath, 'conflict.txt'), 'main edit');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'main edit']);

    // Trigger a merge conflict
    await client.exec(['merge', 'branch-a'], { allowFailure: true });

    // Verify we're in merge state
    let midState = await client.checkMidOperationState();
    expect(midState.inMerge).toBe(true);

    // Abort via our safety method
    await client.abortInProgress();

    // Verify merge state is cleared
    midState = await client.checkMidOperationState();
    expect(midState.inMerge).toBe(false);
    expect(midState.inRebase).toBe(false);
  });

  it('abortInProgress is safe to call when no operation is active', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'safe.txt'), 'content');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'safe commit']);

    // Should not throw even with no active merge/rebase
    await expect(client.abortInProgress()).resolves.not.toThrow();

    const midState = await client.checkMidOperationState();
    expect(midState.inMerge).toBe(false);
    expect(midState.inRebase).toBe(false);
  });

  it('detects detached HEAD state correctly', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'detach.txt'), 'v1');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'commit 1']);

    fs.writeFileSync(path.join(testRepoPath, 'detach.txt'), 'v2');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'commit 2']);

    // Detach HEAD to previous commit
    const prevSha = (await client.exec(['rev-parse', 'HEAD~1'])).stdout.trim();
    await client.exec(['checkout', prevSha]);

    const branch = await client.getCurrentBranch();
    expect(branch).toMatch(/HEAD|detach/i);
  });

  it('stashCreate creates a dangling commit when dirty and returns null when clean', async () => {
    // Need at least one commit in repository for git stash to operate
    fs.writeFileSync(path.join(testRepoPath, 'tracked.txt'), 'tracked initial');
    await client.exec(['add', '.']);
    await client.exec(['commit', '-m', 'init for stash test']);

    // Clean repo
    const cleanSha = await client.stashCreate('clean-check');
    expect(cleanSha).toBeNull();

    // Dirty repo with modified tracked file
    fs.writeFileSync(path.join(testRepoPath, 'tracked.txt'), 'tracked modified content');
    const dirtySha = await client.stashCreate('dirty-check');
    expect(dirtySha).toBeTruthy();
    expect(dirtySha).toMatch(/^[0-9a-f]{40}$/);

    // Verify working tree wasn't reset (stash create leaves working tree intact)
    expect(fs.readFileSync(path.join(testRepoPath, 'tracked.txt'), 'utf-8')).toBe('tracked modified content');
  });
});

