/**
 * GitWizard Pro: Cryptographic Offline-First License & Trial Manager
 * Validates lifetime licenses offline and tracks 14-day zero-card trial.
 */

import crypto from 'node:crypto';

export type LicenseTier = 'pro' | 'free';

export type LicenseStatusCode = 'active_license' | 'active_trial' | 'expired_trial' | 'free';

export interface LicenseStatus {
  isPro: boolean;
  tier: LicenseTier;
  status: LicenseStatusCode;
  email?: string;
  trialDaysRemaining?: number;
  reason?: string;
}

export interface LicenseVerificationResult {
  valid: boolean;
  email?: string;
  issuedAt?: number;
  error?: string;
}

export interface LicenseStorage {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export class InMemoryLicenseStorage implements LicenseStorage {
  private store = new Map<string, string>();

  get(key: string): string | undefined {
    return this.store.get(key);
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }
}

// Built-in verification secret used for cryptographic signature checks
const DEFAULT_SALT = 'gitwizard-pro-lifetime-secret-salt-2026';
const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export class LicenseManager {
  private storage: LicenseStorage;
  private secret: string;

  constructor(storage: LicenseStorage = new InMemoryLicenseStorage(), secret: string = DEFAULT_SALT) {
    this.storage = storage;
    this.secret = secret;
  }

  /**
   * Generates a signed license key for a given email address.
   * Format: GWPRO-LIFETIME.<base64Email>.<timestamp>.<hmacSignature>
   */
  static generateKey(email: string, secret: string = DEFAULT_SALT, issuedAt: number = Date.now()): string {
    const cleanEmail = email.trim().toLowerCase();
    const emailBase64 = Buffer.from(cleanEmail).toString('base64url');
    const payload = `GWPRO-LIFETIME:${emailBase64}:${issuedAt}`;
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return `GWPRO-LIFETIME.${emailBase64}.${issuedAt}.${signature}`;
  }

  /**
   * Cryptographically verifies an offline license key.
   */
  verifyKey(licenseKey: string): LicenseVerificationResult {
    if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.trim()) {
      return { valid: false, error: 'License key is missing or invalid' };
    }

    const trimmed = licenseKey.trim();
    const parts = trimmed.split('.');

    if (parts.length !== 4 || parts[0] !== 'GWPRO-LIFETIME') {
      return { valid: false, error: 'Invalid license key format' };
    }

    const [, emailBase64, timestampStr, providedSignature] = parts;

    // Validate timestamp
    const issuedAt = parseInt(timestampStr, 10);
    if (isNaN(issuedAt) || issuedAt <= 0) {
      return { valid: false, error: 'Invalid timestamp in license key' };
    }

    // Decode email
    let email: string;
    try {
      email = Buffer.from(emailBase64, 'base64url').toString('utf-8');
      if (!email.includes('@') || email.length < 3) {
        return { valid: false, error: 'Invalid email in license key' };
      }
    } catch {
      return { valid: false, error: 'Failed to decode license recipient' };
    }

    // Recompute expected signature
    const expectedPayload = `GWPRO-LIFETIME:${emailBase64}:${issuedAt}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(expectedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      return { valid: false, error: 'Tampered or invalid license signature' };
    }

    return {
      valid: true,
      email,
      issuedAt
    };
  }

  /**
   * Activates a license key and stores it in persistent storage.
   */
  activateLicense(key: string): LicenseStatus {
    const result = this.verifyKey(key);
    if (!result.valid) {
      return {
        isPro: false,
        tier: 'free',
        status: 'free',
        reason: result.error
      };
    }

    this.storage.set('gitwizard_pro_license_key', key.trim());
    return {
      isPro: true,
      tier: 'pro',
      status: 'active_license',
      email: result.email
    };
  }

  /**
   * Deactivates the currently stored license key.
   */
  deactivateLicense(): void {
    this.storage.set('gitwizard_pro_license_key', '');
  }

  /**
   * Retrieves current status (evaluates active license, active trial, or expired trial).
   */
  getStatus(now: number = Date.now()): LicenseStatus {
    // 1. Check for stored license key first
    const storedKey = this.storage.get('gitwizard_pro_license_key');
    if (storedKey) {
      const verifyRes = this.verifyKey(storedKey);
      if (verifyRes.valid) {
        return {
          isPro: true,
          tier: 'pro',
          status: 'active_license',
          email: verifyRes.email
        };
      }
    }

    // 2. Evaluate 14-day local trial
    return this.evaluateTrial(now);
  }

  /**
   * Internal trial tracking logic with clock-rollback protection.
   */
  private evaluateTrial(now: number): LicenseStatus {
    const trialStartedRaw = this.storage.get('gitwizard_trial_start');
    const lastCheckedRaw = this.storage.get('gitwizard_trial_last_checked');

    let trialStartedAt: number;
    let lastCheckedAt = lastCheckedRaw ? parseInt(lastCheckedRaw, 10) : 0;

    if (!trialStartedRaw) {
      // First time user: initialize 14-day trial
      trialStartedAt = now;
      this.storage.set('gitwizard_trial_start', String(trialStartedAt));
      this.storage.set('gitwizard_trial_last_checked', String(now));
    } else {
      trialStartedAt = parseInt(trialStartedRaw, 10);
      if (isNaN(trialStartedAt)) {
        trialStartedAt = now;
        this.storage.set('gitwizard_trial_start', String(trialStartedAt));
      }
    }

    // Anti-clock tampering guard:
    // If the clock was wound backwards by more than 1 hour relative to last check
    if (lastCheckedAt > 0 && now < lastCheckedAt - 3600000) {
      // Clock was turned backwards — treat trial as expired
      return {
        isPro: false,
        tier: 'free',
        status: 'expired_trial',
        trialDaysRemaining: 0,
        reason: 'System clock modification detected. Please activate a license.'
      };
    }

    // Update last checked timestamp
    this.storage.set('gitwizard_trial_last_checked', String(now));

    const elapsed = now - trialStartedAt;
    if (elapsed < TRIAL_DURATION_MS) {
      const msRemaining = TRIAL_DURATION_MS - elapsed;
      const trialDaysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

      return {
        isPro: true,
        tier: 'pro',
        status: 'active_trial',
        trialDaysRemaining
      };
    }

    return {
      isPro: false,
      tier: 'free',
      status: 'expired_trial',
      trialDaysRemaining: 0,
      reason: '14-day free Pro trial has ended. Enter a license key to unlock Pro features.'
    };
  }
}
