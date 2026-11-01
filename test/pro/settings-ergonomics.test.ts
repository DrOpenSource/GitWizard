import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { AIService } from '../../src/pro/ai-service';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { UndoWizard } from '../../src/wizards/undo';

describe('Settings & Ergonomics (Sprint 11 Phase 2)', () => {
  describe('AIService.testConnection', () => {
    it('returns error when API key is missing for cloud providers', async () => {
      const ai = new AIService({ provider: 'gemini', apiKey: '' });
      const res = await ai.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toContain('Please enter an API key for GEMINI');
    });

    it('returns error when OpenAI API key is missing', async () => {
      const ai = new AIService({ provider: 'openai', apiKey: '' });
      const res = await ai.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toContain('Please enter an API key for OPENAI');
    });

    it('tests connection successfully with valid mock response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'pong' }]
              }
            }
          ]
        })
      });

      const ai = new AIService({ provider: 'gemini', apiKey: 'valid-test-key' });
      const res = await ai.testConnection({ fetchFn: mockFetch as any });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected successfully to GEMINI');
    });

    it('supports testing custom credentials before saving', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'pong' } }]
        })
      });

      const ai = new AIService({ provider: 'gemini', apiKey: '' });
      // Test overriding provider and key
      const res = await ai.testConnection({
        provider: 'openai',
        apiKey: 'sk-test-custom-key',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected successfully to OPENAI');
    });

    it('catches and translates connection error cleanly', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const ai = new AIService({ provider: 'ollama', baseUrl: 'http://localhost:11434' });
      const res = await ai.testConnection({ fetchFn: mockFetch as any });

      expect(res.success).toBe(false);
      expect(res.message).toContain('ECONNREFUSED');
    });
  });

  describe('UndoWizard Relative Time & Friendly Actions', () => {
    let testRepoPath: string;
    let client: GitClient;
    let snapshotManager: SnapshotManager;
    let wizard: UndoWizard;

    beforeEach(() => {
      testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ergonomics-undo-test-'));
      execSync('git init -b main', { cwd: testRepoPath });
      execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
      execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

      fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 1');
      execSync('git add . && git commit -m "feat: initial commit"', { cwd: testRepoPath });

      client = new GitClient(testRepoPath);
      snapshotManager = new SnapshotManager(client);
      wizard = new UndoWizard(client, snapshotManager);
    });

    afterEach(() => {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    });

    it('includes relativeTime and friendly title without raw reflog plumbing in action title', async () => {
      fs.writeFileSync(path.join(testRepoPath, 'file.txt'), 'version 2');
      execSync('git add . && git commit -m "feat(cart): add checkout button"', { cwd: testRepoPath });

      const actions = await wizard.getRecentActions();
      expect(actions.length).toBeGreaterThanOrEqual(2);

      const latest = actions[0];
      expect(latest.title).toContain('Saved: "feat(cart): add checkout button"');
      expect(latest.relativeTime).toBeDefined();
      expect(typeof latest.relativeTime).toBe('string');
      // Relative time from Git %cr format is e.g. "seconds ago" or "Just now"
      expect(latest.relativeTime!.length).toBeGreaterThan(0);
    });

    it('formats branch checkout actions in friendly terms', async () => {
      execSync('git checkout -b feature/auth', { cwd: testRepoPath });

      const actions = await wizard.getRecentActions();
      const checkoutAction = actions.find(a => a.category === 'checkout');

      expect(checkoutAction).toBeDefined();
      expect(checkoutAction!.title).toContain('Switched branch');
      expect(checkoutAction!.relativeTime).toBeDefined();
    });
  });
});

