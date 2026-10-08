import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { SafeSyncWizard } from '../../src/wizards/sync';

describe('SafeSyncWizard', () => {
  let remoteRepoPath: string;
  let localRepoPath: string;
  let client: GitClient;
  let snapshotManager: SnapshotManager;
  let wizard: SafeSyncWizard;

  beforeEach(() => {
    // 1. Setup bare remote with default branch main
    remoteRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-remote-bare-'));
    execSync('git init --bare -b main', { cwd: remoteRepoPath });

    // 2. Setup local repo and push initial commit
    localRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-local-'));
    execSync('git init -b main', { cwd: localRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: localRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: localRepoPath });

    fs.writeFileSync(path.join(localRepoPath, 'common.txt'), 'base line');
    execSync('git add . && git commit -m "init"', { cwd: localRepoPath });
    execSync(`git remote add origin "${remoteRepoPath}"`, { cwd: localRepoPath });
    execSync('git push -u origin main', { cwd: localRepoPath });

    client = new GitClient(localRepoPath);
    snapshotManager = new SnapshotManager(client);
    wizard = new SafeSyncWizard(client, snapshotManager);
  });

  afterEach(() => {
    fs.rmSync(remoteRepoPath, { recursive: true, force: true });
    fs.rmSync(localRepoPath, { recursive: true, force: true });
  });

  it('reports up to date when local and remote match', async () => {
    const res = await wizard.safeSync({ remote: 'origin' });
    expect(res.success).toBe(true);
    expect(res.commitsPulled).toBe(0);
    expect(res.message).toContain('already up to date');
  });

  it('pulls remote commits cleanly when upstream has new changes', async () => {
    // Simulate another collaborator committing to the remote on branch main
    const collaboratorPath = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-'));
    execSync(`git clone -b main "${remoteRepoPath}" .`, { cwd: collaboratorPath });
    execSync('git config user.name "Collab"', { cwd: collaboratorPath });
    execSync('git config user.email "collab@test.com"', { cwd: collaboratorPath });

    fs.writeFileSync(path.join(collaboratorPath, 'new_remote_feature.txt'), 'remote work');
    execSync('git add . && git commit -m "feat from remote" && git push origin main', { cwd: collaboratorPath });
    fs.rmSync(collaboratorPath, { recursive: true, force: true });

    // Local runs safeSync
    const res = await wizard.safeSync({ remote: 'origin' });
    expect(res.success).toBe(true);
    expect(res.commitsPulled).toBe(1);
    expect(fs.existsSync(path.join(localRepoPath, 'new_remote_feature.txt'))).toBe(true);
  });

  it('automatically aborts and restores workspace if remote changes conflict', async () => {
    // 1. Collaborator changes common.txt on branch main
    const collaboratorPath = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-'));
    execSync(`git clone -b main "${remoteRepoPath}" .`, { cwd: collaboratorPath });
    execSync('git config user.name "Collab"', { cwd: collaboratorPath });
    execSync('git config user.email "collab@test.com"', { cwd: collaboratorPath });

    fs.writeFileSync(path.join(collaboratorPath, 'common.txt'), 'REMOTE EDIT LINE');
    execSync('git add . && git commit -m "conflicting remote edit" && git push origin main', { cwd: collaboratorPath });
    fs.rmSync(collaboratorPath, { recursive: true, force: true });

    // 2. Local commits contradictory edit to same line
    fs.writeFileSync(path.join(localRepoPath, 'common.txt'), 'LOCAL EDIT LINE');
    execSync('git add common.txt && git commit -m "local conflicting edit"', { cwd: localRepoPath });

    // 3. Run safeSync: must detect conflict, abort, and restore to local edit
    const res = await wizard.safeSync({ remote: 'origin', strategy: 'merge' });

    expect(res.success).toBe(false);
    expect(res.conflictDetected).toBe(true);
    expect(res.rolledBack).toBe(true);

    // Verify local file is intact with local edit and NOT stuck in a conflict state
    expect(fs.readFileSync(path.join(localRepoPath, 'common.txt'), 'utf-8')).toBe('LOCAL EDIT LINE');
    const midState = await client.checkMidOperationState();
    expect(midState.inMerge).toBe(false);
  });
});
