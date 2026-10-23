import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { LicenseManager } from '../../src/pro/license';
import { CloudSyncEngine } from '../../src/pro/cloud-sync';

describe('CloudSyncEngine (Sprint 10)', () => {
  let tempDir: string;
  let git: GitClient;
  let snapshotManager: SnapshotManager;
  let licenseManager: LicenseManager;
  let cloudSync: CloudSyncEngine;
  const testPass = 'SuperSecretSyncPass123!';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-cloud-test-'));
    git = new GitClient(tempDir);

    await git.exec(['init']);
    await git.exec(['checkout', '-b', 'main'], { allowFailure: true });
    await git.exec(['config', 'user.name', 'GitWizard Test']);
    await git.exec(['config', 'user.email', 'test@gitwizard.dev']);
    await git.exec(['config', 'commit.gpgsign', 'false']);

    snapshotManager = new SnapshotManager(git);
    licenseManager = new LicenseManager();
    const key = LicenseManager.generateKey('test@gitwizard.dev');
    licenseManager.activateLicense(key);

    cloudSync = new CloudSyncEngine(git, snapshotManager, licenseManager);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('encrypts and decrypts payload buffer cleanly with AES-256-GCM', () => {
    const rawData = 'Hello GitWizard Encrypted Cloud Backup!';
    const encrypted = cloudSync.encryptPayload(rawData, testPass);

    expect(encrypted.length).toBeGreaterThan(rawData.length);
    expect(encrypted.subarray(0, 12).toString()).toBe('GWCLOUDSYNC1');

    const decrypted = cloudSync.decryptPayload(encrypted, testPass);
    expect(decrypted.toString('utf8')).toBe(rawData);
  });

  it('tamper-detection: rejects tampered ciphertext, bad tag, and wrong passphrase', () => {
    const rawData = 'Sensitive codebase snapshot';
    const encrypted = cloudSync.encryptPayload(rawData, testPass);

    // 1. Wrong passphrase
    expect(() => cloudSync.decryptPayload(encrypted, 'WrongPassphrase!')).toThrow(/Tampered or corrupted/);

    // 2. Tampered ciphertext byte
    const tamperedCipher = Buffer.from(encrypted);
    tamperedCipher[tamperedCipher.length - 2] ^= 0xff; // flip bits
    expect(() => cloudSync.decryptPayload(tamperedCipher, testPass)).toThrow(/Tampered or corrupted/);

    // 3. Corrupted magic header
    const badHeader = Buffer.from(encrypted);
    badHeader[0] = 0x58; // replace 'G' with 'X'
    expect(() => cloudSync.decryptPayload(badHeader, testPass)).toThrow(/unknown magic header/);

    // 4. Empty passphrase
    expect(() => cloudSync.encryptPayload(rawData, '')).toThrow(/passphrase cannot be empty/);
  });

  it('creates and restores sync bundle into a fresh repository', async () => {
    // Commit a file and create a snapshot
    fs.writeFileSync(path.join(tempDir, 'file.ts'), 'export const a = 1;');
    await git.exec(['add', '.']);
    await git.exec(['commit', '-m', 'Initial code']);

    const snap = await snapshotManager.createSnapshot('my-feature-checkpoint');
    expect(snap.id).toBeDefined();

    // Export sync bundle
    const { bundleBuffer, snapshotCount } = await cloudSync.createSyncBundle(testPass);
    expect(snapshotCount).toBe(1);
    expect(bundleBuffer.length).toBeGreaterThan(50);

    // Create a second fresh repository
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-dest-repo-'));
    try {
      const destGit = new GitClient(destDir);
      await destGit.exec(['init']);
      const destSnapshotManager = new SnapshotManager(destGit);
      const destSync = new CloudSyncEngine(destGit, destSnapshotManager, licenseManager);

      const restoreRes = await destSync.restoreSyncBundle(bundleBuffer, testPass);
      expect(restoreRes.restoredSnapshots).toBe(1);

      // Verify restored snapshot metadata
      const restoredList = await destSnapshotManager.listSnapshots();
      expect(restoredList).toHaveLength(1);
      expect(restoredList[0].id).toBe(snap.id);
      expect(restoredList[0].label).toBe(snap.label);
    } finally {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
  });

  it('rejects pushToCloud when remote origin is not configured', async () => {
    const res = await cloudSync.pushToCloud({ remote: 'origin', passphrase: testPass });
    expect(res.success).toBe(false);
    expect(res.message).toContain("No Git remote 'origin' configured");
  });

  it('enforces Pro licensing check on cloud push and pull', async () => {
    vi.spyOn(licenseManager, 'isPro').mockReturnValue(false);

    const pushRes = await cloudSync.pushToCloud({ remote: 'origin', passphrase: testPass });
    expect(pushRes.success).toBe(false);
    expect(pushRes.requiresPro).toBe(true);

    const pullRes = await cloudSync.pullFromCloud({ remote: 'origin', passphrase: testPass });
    expect(pullRes.success).toBe(false);
    expect(pullRes.requiresPro).toBe(true);
  });
});
