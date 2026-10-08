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
});
