import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretRemediationEngine } from '../../src/pro/secret-remediation';
import { DetectedSecret } from '../../src/pro/secret-scanner';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SecretRemediationEngine', () => {
  let tmpDir: string;
  let engine: SecretRemediationEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-remediation-test-'));
    engine = new SecretRemediationEngine(tmpDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates .env and adds to .gitignore when neither exists', () => {
    const srcFile = path.join(tmpDir, 'app.ts');
    fs.writeFileSync(srcFile, 'const apiKey = "sk-proj-1234567890abcdef";');

    const secret: DetectedSecret = {
      ruleId: 'openai-api-key',
      ruleName: 'OpenAI API Key',
      file: 'app.ts',
      line: 1,
      rawSecret: 'sk-proj-1234567890abcdef',
      maskedSecret: 'sk-p...cdef'
    };

    const res = engine.remediateSecrets([secret]);
    expect(res.success).toBe(true);

    // Verify .env was created with variable
    const envContent = fs.readFileSync(path.join(tmpDir, '.env'), 'utf-8');
    expect(envContent).toContain('OPENAI_API_KEY="sk-proj-1234567890abcdef"');

    // Verify .gitignore was created with .env
    const gitignoreContent = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignoreContent).toContain('.env');

    // Verify source file was replaced
    const srcContent = fs.readFileSync(srcFile, 'utf-8');
    expect(srcContent).toBe('const apiKey = process.env.OPENAI_API_KEY;');
  });

  it('appends to existing .env without clobbering existing variables', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'PORT=3000\nNODE_ENV="development"\n');

    const srcFile = path.join(tmpDir, 'stripe.ts');
    fs.writeFileSync(srcFile, 'const stripe = new Stripe("sk_live_dummy1234567890abcdef");');

    const secret: DetectedSecret = {
      ruleId: 'stripe-live-secret',
      ruleName: 'Stripe Live Secret Key',
      file: 'stripe.ts',
      line: 1,
      rawSecret: 'sk_live_dummy1234567890abcdef',
      maskedSecret: 'sk_l...2345'
    };

    const res = engine.remediateSecrets([secret]);
    expect(res.success).toBe(true);

    const updatedEnv = fs.readFileSync(envPath, 'utf-8');
    expect(updatedEnv).toContain('PORT=3000');
    expect(updatedEnv).toContain('NODE_ENV="development"');
    expect(updatedEnv).toContain('STRIPE_SECRET_KEY="sk_live_dummy1234567890abcdef"');

    const updatedSrc = fs.readFileSync(srcFile, 'utf-8');
    expect(updatedSrc).toBe('const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);');
  });

  it('does not add duplicate .env entries to .gitignore', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'node_modules\n.env\ndist\n');

    const srcFile = path.join(tmpDir, 'db.ts');
    fs.writeFileSync(srcFile, 'const url = "postgres://user:pass@localhost:5432/db";');

    const secret: DetectedSecret = {
      ruleId: 'database-url-credentials',
      ruleName: 'Database URL',
      file: 'db.ts',
      line: 1,
      rawSecret: 'postgres://user:pass@localhost:5432/db',
      maskedSecret: 'post...2/db'
    };

    const res = engine.remediateSecrets([secret]);
    expect(res.success).toBe(true);

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const matches = gitignoreContent.match(/^\.env$/gm);
    expect(matches?.length).toBe(1);
  });

  it('simultaneously extracts multiple different secrets with deduplicated variable names', () => {
    const srcFile = path.join(tmpDir, 'multi.ts');
    fs.writeFileSync(
      srcFile,
      'const key1 = "sk-proj-key11111111111111111111111";\nconst key2 = "sk-proj-key22222222222222222222222";\nconst gemini = "AIzaSyD-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";'
    );

    const secrets: DetectedSecret[] = [
      {
        ruleId: 'openai-api-key',
        ruleName: 'OpenAI API Key',
        file: 'multi.ts',
        line: 1,
        rawSecret: 'sk-proj-key11111111111111111111111',
        maskedSecret: 'sk-p...1111'
      },
      {
        ruleId: 'openai-api-key',
        ruleName: 'OpenAI API Key',
        file: 'multi.ts',
        line: 2,
        rawSecret: 'sk-proj-key22222222222222222222222',
        maskedSecret: 'sk-p...2222'
      },
      {
        ruleId: 'google-api-key',
        ruleName: 'Google Gemini Key',
        file: 'multi.ts',
        line: 3,
        rawSecret: 'AIzaSyD-aBcDeFgHiJkLmNoPqRsTuVwXyZ12345',
        maskedSecret: 'AIza...2345'
      }
    ];

    const res = engine.remediateSecrets(secrets);
    expect(res.success).toBe(true);
    expect(res.remediated.length).toBe(3);
    expect(res.remediated[0].variableName).toBe('OPENAI_API_KEY');
    expect(res.remediated[1].variableName).toBe('OPENAI_API_KEY_2');
    expect(res.remediated[2].variableName).toBe('GEMINI_API_KEY');

    const envContent = fs.readFileSync(path.join(tmpDir, '.env'), 'utf-8');
    expect(envContent).toContain('OPENAI_API_KEY=');
    expect(envContent).toContain('OPENAI_API_KEY_2=');
    expect(envContent).toContain('GEMINI_API_KEY=');

    const srcContent = fs.readFileSync(srcFile, 'utf-8');
    expect(srcContent).toContain('process.env.OPENAI_API_KEY;');
    expect(srcContent).toContain('process.env.OPENAI_API_KEY_2;');
    expect(srcContent).toContain('process.env.GEMINI_API_KEY');
  });
});
