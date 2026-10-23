import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { GitClient } from '../../src/engine/git-client';
import { AIService } from '../../src/pro/ai-service';
import { LicenseManager, InMemoryLicenseStorage } from '../../src/pro/license';
import { AICommitWizard } from '../../src/wizards/ai-commit';

describe('AICommitWizard (Chunk 7.3 AI Conventional Commit & PR Generator)', () => {
  let testRepoPath: string;
  let client: GitClient;
  let aiService: AIService;
  let licenseManager: LicenseManager;
  let wizard: AICommitWizard;
  let storage: InMemoryLicenseStorage;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-commit-test-'));
    execSync('git init -b main', { cwd: testRepoPath });
    execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'initial content');
    execSync('git add . && git commit -m "init"', { cwd: testRepoPath });

    client = new GitClient(testRepoPath);
    storage = new InMemoryLicenseStorage();
    licenseManager = new LicenseManager(storage);

    // Initialize AI Service with dummy key (mocking fetch)
    aiService = new AIService({ provider: 'gemini', apiKey: 'test-key' });
    wizard = new AICommitWizard(client, aiService, licenseManager);
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {
      // Windows handle release grace
    }
  });

  it('requires-pro: returns requiresPro when trial is expired and no license is activated', async () => {
    // Simulate expired trial (15 days ago)
    const longAgo = Date.now() - 20 * 24 * 60 * 60 * 1000;
    storage.set('gitwizard_trial_start', String(longAgo));
    storage.set('gitwizard_trial_last_checked', String(Date.now()));

    const res = await wizard.generateCommitMessage();
    expect(res.success).toBe(false);
    expect(res.requiresPro).toBe(true);
    expect(res.error).toContain('trial has ended');
  });

  it('empty-diff: warns user when working tree is completely clean', async () => {
    const res = await wizard.generateCommitMessage();
    expect(res.success).toBe(false);
    expect(res.error).toContain('Working tree is completely clean');
  });

  it('single-file-commit: generates conventional commit message from diff', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'updated with new login feature');

    // Mock AI completion
    vi.spyOn(aiService, 'generateCompletion').mockResolvedValueOnce({
      success: true,
      content: 'feat(auth): implement new login workflow\n\n- Updated initial login handler',
      provider: 'gemini',
      model: 'gemini-1.5-flash'
    });

    const res = await wizard.generateCommitMessage();
    expect(res.success).toBe(true);
    expect(res.commitMessage).toContain('feat(auth): implement new login workflow');
    expect(res.summary).toBe('feat(auth): implement new login workflow');
  });

  it('malformed-llm-response: cleanly strips markdown code fences from LLM output', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'initial.txt'), 'bug fix content');

    vi.spyOn(aiService, 'generateCompletion').mockResolvedValueOnce({
      success: true,
      content: '```markdown\nfix(core): resolve null pointer exception in parser\n```',
      provider: 'gemini',
      model: 'gemini-1.5-flash'
    });

    const res = await wizard.generateCommitMessage();
    expect(res.success).toBe(true);
    expect(res.commitMessage).toBe('fix(core): resolve null pointer exception in parser');
  });

  it('untracked-files: extracts content of new untracked files into diff context', async () => {
    fs.writeFileSync(path.join(testRepoPath, 'new_component.tsx'), 'export const Modal = () => <div />;');

    let receivedPrompt = '';
    vi.spyOn(aiService, 'generateCompletion').mockImplementation(async (prompt) => {
      receivedPrompt = prompt;
      return {
        success: true,
        content: 'feat(ui): add Modal component',
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      };
    });

    const res = await wizard.generateCommitMessage();
    expect(res.success).toBe(true);
    expect(receivedPrompt).toContain('new_component.tsx');
    expect(receivedPrompt).toContain('export const Modal');
  });

  it('pr-description: generates structured pull request title and body', async () => {
    // Create feature branch with a commit
    execSync('git checkout -b feature/stripe-billing', { cwd: testRepoPath });
    fs.writeFileSync(path.join(testRepoPath, 'billing.ts'), 'export const charge = () => true;');
    execSync('git add . && git commit -m "feat(billing): add stripe charge logic"', { cwd: testRepoPath });

    vi.spyOn(aiService, 'generateCompletion').mockResolvedValueOnce({
      success: true,
      content: `TITLE: feat(billing): integrate Stripe checkout
---
### 🎯 Objective
Enable users to purchase subscriptions.

### 🛠️ Changes Made
- Added billing.ts with charge method

### 🧪 Verification
Tested with mock API keys.`,
      provider: 'gemini',
      model: 'gemini-1.5-flash'
    });

    const res = await wizard.generatePRDescription('main');
    expect(res.success).toBe(true);
    expect(res.title).toBe('feat(billing): integrate Stripe checkout');
    expect(res.body).toContain('### 🎯 Objective');
    expect(res.body).toContain('Enable users to purchase subscriptions');
  });
});
