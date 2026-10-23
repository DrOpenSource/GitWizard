import { describe, it, expect, beforeEach } from 'vitest';
import { LicenseManager, InMemoryLicenseStorage } from '../../src/pro/license';

describe('LicenseManager (Chunk 7.1 Offline Licensing & Trial Engine)', () => {
  let storage: InMemoryLicenseStorage;
  let manager: LicenseManager;
  const testEmail = 'vibe.coder@example.com';

  beforeEach(() => {
    storage = new InMemoryLicenseStorage();
    manager = new LicenseManager(storage);
  });

  it('valid-license: successfully verifies and activates an authentic signed key', () => {
    const key = LicenseManager.generateKey(testEmail);
    expect(key.startsWith('GWPRO-LIFETIME.')).toBe(true);

    const verification = manager.verifyKey(key);
    expect(verification.valid).toBe(true);
    expect(verification.email).toBe(testEmail);
    expect(verification.issuedAt).toBeGreaterThan(0);

    const status = manager.activateLicense(key);
    expect(status.isPro).toBe(true);
    expect(status.status).toBe('active_license');
    expect(status.tier).toBe('pro');
    expect(status.email).toBe(testEmail);
  });

  it('tampered-key: rejects modified payload or altered signature', () => {
    const key = LicenseManager.generateKey(testEmail);
    const parts = key.split('.');

    // Tamper with the base64 email part
    const tamperedPayload = [parts[0], Buffer.from('hacker@example.com').toString('base64url'), parts[2], parts[3]].join('.');
    const res1 = manager.verifyKey(tamperedPayload);
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('Tampered');

    // Tamper with signature
    const badSignature = parts[3].slice(0, -4) + 'abcd';
    const tamperedSig = [parts[0], parts[1], parts[2], badSignature].join('.');
    const res2 = manager.verifyKey(tamperedSig);
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain('Tampered');
  });

  it('empty-and-malformed: rejects invalid strings, whitespace, and wrong delimiters', () => {
    expect(manager.verifyKey('')).toEqual({ valid: false, error: 'License key is missing or invalid' });
    expect(manager.verifyKey('   ')).toEqual({ valid: false, error: 'License key is missing or invalid' });
    expect(manager.verifyKey('INVALID-KEY')).toEqual({ valid: false, error: 'Invalid license key format' });
    expect(manager.verifyKey('GWPRO-LIFETIME.abc.invalid-timestamp.sig')).toEqual({
      valid: false,
      error: 'Invalid timestamp in license key'
    });
  });

  it('trial-active: starts 14-day trial on first run and calculates remaining days', () => {
    const now = 1700000000000;
    const status = manager.getStatus(now);

    expect(status.isPro).toBe(true);
    expect(status.tier).toBe('pro');
    expect(status.status).toBe('active_trial');
    expect(status.trialDaysRemaining).toBe(14);

    // 5 days later
    const day5 = now + 5 * 24 * 60 * 60 * 1000;
    const statusDay5 = manager.getStatus(day5);
    expect(statusDay5.isPro).toBe(true);
    expect(statusDay5.status).toBe('active_trial');
    expect(statusDay5.trialDaysRemaining).toBe(9);
  });

  it('trial-expired: gracefully transitions to Free tier after 14 days without locking repo', () => {
    const startTime = 1700000000000;
    manager.getStatus(startTime); // initialize trial

    // 15 days later
    const day15 = startTime + 15 * 24 * 60 * 60 * 1000;
    const statusDay15 = manager.getStatus(day15);

    expect(statusDay15.isPro).toBe(false);
    expect(statusDay15.tier).toBe('free');
    expect(statusDay15.status).toBe('expired_trial');
    expect(statusDay15.trialDaysRemaining).toBe(0);
    expect(statusDay15.reason).toContain('14-day free Pro trial has ended');
  });

  it('clock-rollback: detects system clock manipulation and expires trial safely', () => {
    const startTime = 1700000000000;
    manager.getStatus(startTime); // checked at startTime

    // Advanced 2 days
    const day2 = startTime + 2 * 24 * 60 * 60 * 1000;
    manager.getStatus(day2); // checked at day 2

    // System clock wound backwards by 10 days
    const woundBackTime = startTime - 10 * 24 * 60 * 60 * 1000;
    const status = manager.getStatus(woundBackTime);

    expect(status.isPro).toBe(false);
    expect(status.status).toBe('expired_trial');
    expect(status.reason).toContain('clock modification detected');
  });

  it('deactivateLicense: clears active key and falls back to trial or free', () => {
    const key = LicenseManager.generateKey(testEmail);
    manager.activateLicense(key);
    expect(manager.getStatus().status).toBe('active_license');

    manager.deactivateLicense();
    expect(manager.getStatus().status).not.toBe('active_license');
  });
});
