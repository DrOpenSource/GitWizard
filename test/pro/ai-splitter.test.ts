import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AISplitterEngine } from '../../src/pro/ai-splitter';
import { GitClient } from '../../src/engine/git-client';
import { AIService } from '../../src/pro/ai-service';
import { LicenseManager, InMemoryLicenseStorage } from '../../src/pro/license';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('AISplitterEngine', () => {
  let testRepoPath: string;
  let git: GitClient;
  let licenseManager: LicenseManager;
  let storage: InMemoryLicenseStorage;
  let aiService: AIService;
  let splitter: AISplitterEngine;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ai-splitter-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Split Tester"', { cwd: testRepoPath });
    execSync('git config user.email "split@test.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: testRepoPath });

    git = new GitClient(testRepoPath);
    storage = new InMemoryLicenseStorage();
    licenseManager = new LicenseManager(storage);
    aiService = new AIService({ provider: 'gemini', apiKey: 'test-key' });
    splitter = new AISplitterEngine(git, aiService, licenseManager);
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {}
  });

  it('rejects planning when trial is expired and license is not active', async () => {
    // Expire trial by setting start timestamp to 30 days ago
    storage.set('gitwizard_trial_start', String(Date.now() - 30 * 24 * 60 * 60 * 1000));
    storage.set('gitwizard_trial_last_checked', String(Date.now()));

    fs.writeFileSync(path.join(testRepoPath, 'fileA.ts'), 'content A');
    fs.writeFileSync(path.join(testRepoPath, 'fileB.ts'), 'content B');

    const res = await splitter.planAutoSplit();
    expect(res.success).toBe(false);
    expect(res.requiresPro).toBe(true);
  });

  it('warns when workspace is completely clean', async () => {
    const res = await splitter.planAutoSplit();
    expect(res.success).toBe(false);
    expect(res.error).toContain('clean');
  });

  it('warns when only 1 file is dirty (split not needed)', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'only-one.ts'), 'content');

    const res = await splitter.planAutoSplit();
    expect(res.success).toBe(false);
    expect(res.error).toContain('Only 1 file is modified');
  });

  it('clusters files using AI when complete response is returned', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'server.ts'), 'export const server = 1;');
    fs.writeFileSync(path.join(testRepoPath, 'Button.tsx'), 'export const Button = () => null;');

    // Mock AI completion
    vi.spyOn(aiService, 'generateCompletion').mockResolvedValue({
      success: true,
      content: JSON.stringify([
        {
          branchName: 'feature/backend-api',
          commitMessage: 'feat(api): add server setup',
          rationale: 'Backend server configuration',
          files: ['server.ts']
        },
        {
          branchName: 'feature/frontend-ui',
          commitMessage: 'feat(ui): add Button component',
          rationale: 'Frontend UI component',
          files: ['Button.tsx']
        }
      ]),
      provider: 'gemini',
      model: 'gemini-1.5-flash'
    });

    const res = await splitter.planAutoSplit();
    expect(res.success).toBe(true);
    expect(res.groups.length).toBe(2);
    expect(res.groups[0].branchName).toBe('feature/backend-api');
    expect(res.groups[0].files).toEqual(['server.ts']);
    expect(res.groups[1].branchName).toBe('feature/frontend-ui');
    expect(res.groups[1].files).toEqual(['Button.tsx']);
  });

  it('falls back to deterministic structural heuristic when offline or LLM errors', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'server.ts'), 'backend logic');
    fs.writeFileSync(path.join(testRepoPath, 'App.tsx'), 'frontend logic');
    fs.writeFileSync(path.join(testRepoPath, 'style.css'), 'body {}');

    // Force AI complete failure
    vi.spyOn(aiService, 'generateCompletion').mockRejectedValue(new Error('Network offline'));

    const res = await splitter.planAutoSplit();
    expect(res.success).toBe(true);
    expect(res.groups.length).toBe(2);
    expect(res.groups[0].branchName).toBe('feature/frontend-ui');
    expect(res.groups[0].files).toEqual(['App.tsx', 'style.css']);
    expect(res.groups[1].branchName).toBe('feature/backend-core');
    expect(res.groups[1].files).toEqual(['server.ts']);
  });
});
