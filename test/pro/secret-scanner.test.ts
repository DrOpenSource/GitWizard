import { describe, it, expect } from 'vitest';
import { SecretScanner } from '../../src/pro/secret-scanner';

describe('SecretScanner', () => {
  const scanner = new SecretScanner();

  it('detects OpenAI project and admin API keys', () => {
    const diff = `
+ const openaiKey = "sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx";
+ const adminKey = "sk-admin-xyz987wvu654tsr321qpo098nml765kji432hgf109";
    `;
    const res = scanner.scanContent(diff, 'src/api.ts');
    expect(res.hasSecrets).toBe(true);
    expect(res.totalFound).toBe(2);
    expect(res.secrets[0].ruleId).toBe('openai-api-key');
    expect(res.secrets[0].maskedSecret).toBe('sk-p...1vwx');
  });

  it('detects Stripe live keys and respects allowTestKeys option', () => {
    const mockLive = ['sk_live', '51Ozabc1234567890abcdef12'].join('_');
    const mockTest = ['sk_test', '51Ozabc1234567890abcdef12'].join('_');
    const diff = `
+ const stripeLive = "${mockLive}";
+ const stripeTest = "${mockTest}";
    `;
    // Default: both live and test are scanned
    const defaultRes = scanner.scanContent(diff, 'billing.ts');
    expect(defaultRes.totalFound).toBe(2);

    // With allowTestKeys: true
    const laxScanner = new SecretScanner({ allowTestKeys: true });
    const laxRes = laxScanner.scanContent(diff, 'billing.ts');
    expect(laxRes.totalFound).toBe(1);
    expect(laxRes.secrets[0].ruleId).toBe('stripe-live-secret');
  });

  it('detects AWS Access Key ID', () => {
    const diff = `
+ AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
    `;
    const res = scanner.scanContent(diff, '.env.production');
    expect(res.hasSecrets).toBe(true);
    expect(res.secrets[0].ruleId).toBe('aws-access-key-id');
    expect(res.secrets[0].rawSecret).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('detects Google Gemini and Cloud API keys', () => {
    const diff = `
+ const geminiKey = "AIzaSyD-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";
    `;
    const res = scanner.scanContent(diff, 'config.ts');
    expect(res.hasSecrets).toBe(true);
    expect(res.secrets[0].ruleId).toBe('google-api-key');
  });

  it('detects Database URLs containing plaintext passwords', () => {
    const diff = `
+ DATABASE_URL="postgres://app_user:superSecretPass123!@db.production.internal:5432/main_db"
    `;
    const res = scanner.scanContent(diff, 'server.ts');
    expect(res.hasSecrets).toBe(true);
    expect(res.secrets[0].ruleId).toBe('database-url-credentials');
  });

  it('detects PEM Private Key headers', () => {
    const diff = `
+ -----BEGIN RSA PRIVATE KEY-----
+ MIIEowIBAAKCAQEA0Y7VvQ...
+ -----END RSA PRIVATE KEY-----
    `;
    const res = scanner.scanContent(diff, 'cert.pem');
    expect(res.hasSecrets).toBe(true);
    expect(res.secrets[0].ruleId).toBe('private-key-pem');
  });

  it('detects un-prefixed high-entropy credentials via Shannon entropy', () => {
    // 40 random base64 chars with high randomness
    const diff = `
+ const customSecret = "8f+N3k/LpQ9w2eR7tY1uI4oP6aS8dF0gH2jK5lZ=";
    `;
    const res = scanner.scanContent(diff, 'security.ts');
    expect(res.hasSecrets).toBe(true);
    expect(res.secrets.some(s => s.ruleId === 'high-entropy-token')).toBe(true);
  });

  it('suppresses false positives from UUIDs, commit hashes, and plain words', () => {
    const diff = `
+ const id = "550e8400-e29b-41d4-a716-446655440000";
+ const commitSha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
+ const variableName = "someVeryLongCamelCaseIdentifierForComponentState";
    `;
    const res = scanner.scanContent(diff, 'utils.ts');
    expect(res.hasSecrets).toBe(false);
    expect(res.totalFound).toBe(0);
  });

  it('benchmarks scanning 1,000 lines in < 100ms', () => {
    const lines = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`const line${i} = "normal code line doing standard operations with id-${i}";`);
    }
    lines.push('const leaked = "sk-proj-bench1234567890abcdef1234567890abcdef";');
    const content = lines.join('\n');

    const res = scanner.scanContent(content, 'benchmark.ts');
    expect(res.hasSecrets).toBe(true);
    expect(res.scanDurationMs).toBeLessThan(100);
  });
});
