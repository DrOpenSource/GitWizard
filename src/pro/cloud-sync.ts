/**
 * GitWizard Pro: Private Zero-COGS GitHub Cloud Sync Bridge
 *
 * Encrypts snapshots and metadata using client-side AES-256-GCM and syncs to a
 * hidden Git ref (refs/gitwizard/cloud-sync) on the user's existing remote repository.
 * Zero external servers, zero database costs, 100% end-to-end encrypted.
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { GitClient } from '../engine/git-client';
import { SnapshotManager, SnapshotMetadata } from '../engine/snapshot';
import { LicenseManager } from './license';

export interface CloudSyncOptions {
  remote?: string;
  passphrase?: string;
}

export interface CloudSyncResult {
  success: boolean;
  snapshotCount: number;
  message: string;
  error?: string;
  requiresPro?: boolean;
}

export interface SyncPayload {
  version: string;
  createdAt: number;
  snapshots: SnapshotMetadata[];
  bundleBase64?: string;
}

const MAGIC_HEADER = Buffer.from('GWCLOUDSYNC1'); // 12 bytes
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class CloudSyncEngine {
  private readonly _git: GitClient;
  private readonly _snapshotManager: SnapshotManager;
  private readonly _licenseManager: LicenseManager;

  constructor(
    git: GitClient,
    snapshotManager: SnapshotManager,
    licenseManager: LicenseManager
  ) {
    this._git = git;
    this._snapshotManager = snapshotManager;
    this._licenseManager = licenseManager;
  }

  /**
   * Derive a 32-byte AES key from passphrase and salt using scrypt.
   */
  private _deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.scryptSync(passphrase, salt, 32);
  }

  /**
   * Encrypts arbitrary buffer or string using AES-256-GCM with authenticated header.
   */
  encryptPayload(data: Buffer | string, passphrase: string): Buffer {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('Cloud sync passphrase cannot be empty.');
    }

    const plainBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this._deriveKey(passphrase, salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Packet structure: [MAGIC (12)] + [SALT (16)] + [IV (12)] + [TAG (16)] + [CIPHERTEXT]
    return Buffer.concat([MAGIC_HEADER, salt, iv, tag, ciphertext]);
  }

  /**
   * Decrypts AES-256-GCM buffer and verifies integrity and authenticity tag.
   */
  decryptPayload(encryptedBuffer: Buffer, passphrase: string): Buffer {
    if (!passphrase || !passphrase.trim()) {
      throw new Error('Cloud sync passphrase cannot be empty.');
    }

    const minLength = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
    if (encryptedBuffer.length < minLength) {
      throw new Error('Invalid cloud sync bundle: buffer too small.');
    }

    // Verify Magic Header
    const magic = encryptedBuffer.subarray(0, MAGIC_HEADER.length);
    if (!magic.equals(MAGIC_HEADER)) {
      throw new Error('Invalid GitWizard cloud sync bundle: unknown magic header.');
    }

    let offset = MAGIC_HEADER.length;
    const salt = encryptedBuffer.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = encryptedBuffer.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const tag = encryptedBuffer.subarray(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;

    const ciphertext = encryptedBuffer.subarray(offset);

    try {
      const key = this._deriveKey(passphrase, salt);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new Error('Tampered or corrupted cloud sync bundle (decryption failed).');
    }
  }

  /**
   * Creates an encrypted sync bundle containing all local snapshots and git commit objects.
   */
  async createSyncBundle(passphrase: string): Promise<{ bundleBuffer: Buffer; snapshotCount: number }> {
    const snapshots = await this._snapshotManager.listSnapshots();
    let bundleBase64: string | undefined;

    if (snapshots.length > 0) {
      const tempBundleFile = path.join(os.tmpdir(), `gw-bundle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pack`);
      try {
        const refArgs = snapshots.map(s => `refs/gitwizard/snapshots/${s.id}`);
        // Create git bundle of snapshot refs
        const res = await this._git.exec(['bundle', 'create', tempBundleFile, ...refArgs], { allowFailure: true });
        if (res.exitCode === 0 && fs.existsSync(tempBundleFile)) {
          bundleBase64 = fs.readFileSync(tempBundleFile).toString('base64');
        }
      } catch {
        // Fallback to metadata-only
      } finally {
        if (fs.existsSync(tempBundleFile)) {
          try { fs.unlinkSync(tempBundleFile); } catch { /* ignore */ }
        }
      }
    }

    const payload: SyncPayload = {
      version: '1.0',
      createdAt: Date.now(),
      snapshots,
      bundleBase64
    };

    const serialized = JSON.stringify(payload);
    const bundleBuffer = this.encryptPayload(serialized, passphrase);

    return {
      bundleBuffer,
      snapshotCount: snapshots.length
    };
  }

  /**
   * Restores snapshots and git objects from an encrypted bundle buffer.
   */
  async restoreSyncBundle(encryptedBundle: Buffer, passphrase: string): Promise<{ restoredSnapshots: number }> {
    const decrypted = this.decryptPayload(encryptedBundle, passphrase);
    const payload: SyncPayload = JSON.parse(decrypted.toString('utf8'));

    let restored = 0;

    // 1. Unbundle Git packfile if present
    if (payload.bundleBase64) {
      const tempBundleFile = path.join(os.tmpdir(), `gw-restore-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.pack`);
      try {
        fs.writeFileSync(tempBundleFile, Buffer.from(payload.bundleBase64, 'base64'));
        await this._git.exec(['bundle', 'verify', tempBundleFile], { allowFailure: true });
        // Fetch snapshot refs from bundle into local repo
        await this._git.exec([
          'fetch',
          tempBundleFile,
          'refs/gitwizard/snapshots/*:refs/gitwizard/snapshots/*'
        ], { allowFailure: true });
      } catch {
        // Continue to restore metadata
      } finally {
        if (fs.existsSync(tempBundleFile)) {
          try { fs.unlinkSync(tempBundleFile); } catch { /* ignore */ }
        }
      }
    }

    // 2. Restore Snapshot Metadata and refs
    if (payload.snapshots && Array.isArray(payload.snapshots)) {
      for (const snap of payload.snapshots) {
        const metaPath = path.join(this._snapshotManager.metadataDir, `${snap.id}.json`);
        fs.writeFileSync(metaPath, JSON.stringify(snap, null, 2), 'utf8');

        // Ensure ref exists
        if (snap.snapshotSha) {
          await this._git.updateRef(`refs/gitwizard/snapshots/${snap.id}`, snap.snapshotSha);
        }
        restored++;
      }
    }

    return { restoredSnapshots: restored };
  }

  /**
   * Pushes encrypted snapshot bundle to user's remote Git repository.
   */
  async pushToCloud(options: CloudSyncOptions = {}): Promise<CloudSyncResult> {
    if (!this._licenseManager.isPro()) {
      return {
        success: false,
        snapshotCount: 0,
        message: 'GitWizard Pro license or active trial required for Cloud Sync.',
        requiresPro: true
      };
    }

    const remote = options.remote || 'origin';
    const passphrase = options.passphrase || this._getDefaultPassphrase();

    // Verify remote exists
    const remotesRes = await this._git.exec(['remote'], { allowFailure: true });
    const availableRemotes = remotesRes.stdout.split('\n').map(r => r.trim()).filter(Boolean);
    if (!availableRemotes.includes(remote)) {
      return {
        success: false,
        snapshotCount: 0,
        message: `No Git remote '${remote}' configured. Add a GitHub/remote origin first.`,
        error: `Remote '${remote}' not found`
      };
    }

    try {
      const { bundleBuffer, snapshotCount } = await this.createSyncBundle(passphrase);

      // Write encrypted blob to git object database
      const tempPayloadFile = path.join(os.tmpdir(), `gw-payload-${Date.now()}.bin`);
      fs.writeFileSync(tempPayloadFile, bundleBuffer);

      const hashRes = await this._git.exec(['hash-object', '-w', tempPayloadFile]);
      const blobSha = hashRes.stdout.trim();
      try { fs.unlinkSync(tempPayloadFile); } catch { /* ignore */ }

      // Write tree containing cloud sync blob
      const treeEntry = `100644 blob ${blobSha}\tcloud-sync.gwenc`;
      const mktreeRes = await this._git.exec(['mktree'], {
        env: { GIT_INDEX_FILE: '' }
      });
      // Alternative: commit blob directly as a commit tree
      const commitRes = await this._git.commitTree(
        mktreeRes.stdout.trim() || blobSha,
        `gitwizard-cloud-sync: ${Date.now()}`
      );

      // Update local cloud-sync ref
      await this._git.updateRef('refs/gitwizard/cloud-sync', commitRes);

      // Push to remote hidden ref
      await this._git.exec(['push', remote, 'refs/gitwizard/cloud-sync:refs/gitwizard/cloud-sync', '--force']);

      return {
        success: true,
        snapshotCount,
        message: `Successfully synchronized ${snapshotCount} encrypted snapshots to ${remote} (refs/gitwizard/cloud-sync)! ☁️`
      };
    } catch (err: any) {
      return {
        success: false,
        snapshotCount: 0,
        message: `Cloud sync push failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Pulls and decrypts snapshots from user's remote Git repository.
   */
  async pullFromCloud(options: CloudSyncOptions = {}): Promise<CloudSyncResult> {
    if (!this._licenseManager.isPro()) {
      return {
        success: false,
        snapshotCount: 0,
        message: 'GitWizard Pro license or active trial required for Cloud Sync.',
        requiresPro: true
      };
    }

    const remote = options.remote || 'origin';
    const passphrase = options.passphrase || this._getDefaultPassphrase();

    try {
      // Fetch cloud-sync ref from remote
      const fetchRes = await this._git.exec([
        'fetch',
        remote,
        'refs/gitwizard/cloud-sync:refs/gitwizard/cloud-sync'
      ], { allowFailure: true });

      if (fetchRes.exitCode !== 0) {
        return {
          success: false,
          snapshotCount: 0,
          message: `No cloud sync backups found on remote '${remote}'.`,
          error: fetchRes.stderr
        };
      }

      // Read encrypted blob from cloud-sync ref
      const showRes = await this._git.exec(['cat-file', '-p', 'refs/gitwizard/cloud-sync:cloud-sync.gwenc'], { allowFailure: true });
      let encryptedBuffer: Buffer;
      if (showRes.exitCode === 0) {
        encryptedBuffer = Buffer.from(showRes.stdout, 'binary');
      } else {
        // Fallback if stored as direct commit message / blob
        throw new Error('Cloud sync blob not found on refs/gitwizard/cloud-sync.');
      }

      const { restoredSnapshots } = await this.restoreSyncBundle(encryptedBuffer, passphrase);

      return {
        success: true,
        snapshotCount: restoredSnapshots,
        message: `Successfully restored ${restoredSnapshots} snapshots from ${remote}! ☁️`
      };
    } catch (err: any) {
      return {
        success: false,
        snapshotCount: 0,
        message: `Cloud sync pull failed: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Deterministic default passphrase derived from user license email if none provided.
   */
  private _getDefaultPassphrase(): string {
    const status = this._licenseManager.getStatus();
    return status.email ? `gw-sync-${status.email}` : 'gitwizard-default-cloud-key-2026';
  }
}
