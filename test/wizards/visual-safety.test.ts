import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { getFileCategory, getCategoryBadge } from '../../src/engine/file-category';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { CheckpointWizard } from '../../src/wizards/checkpoint';

describe('Phase 3: Visual Safety & File Categorization', () => {
  describe('getFileCategory & Badges', () => {
    it('classifies frontend UI files correctly', () => {
      expect(getFileCategory('src/components/Button.tsx')).toBe('ui');
      expect(getFileCategory('src/styles/main.css')).toBe('ui');
      expect(getFileCategory('src/views/Dashboard.vue')).toBe('ui');
      expect(getFileCategory('public/index.html')).toBe('ui');
      expect(getFileCategory('src/Card.jsx')).toBe('ui');
      expect(getFileCategory('src/theme.scss')).toBe('ui');

      const badge = getCategoryBadge('ui');
      expect(badge.label).toBe('UI');
      expect(badge.icon).toBe('🎨');
    });

    it('classifies backend, database, and logic files correctly', () => {
      expect(getFileCategory('prisma/schema.prisma')).toBe('backend');
      expect(getFileCategory('migrations/init.sql')).toBe('backend');
      expect(getFileCategory('api/auth.py')).toBe('backend');
      expect(getFileCategory('src/api/routes.ts')).toBe('backend');
      expect(getFileCategory('server/main.go')).toBe('backend');
      expect(getFileCategory('src/services/billing.ts')).toBe('backend');
      expect(getFileCategory('test/auth.test.ts')).toBe('backend');

      const badge = getCategoryBadge('backend');
      expect(badge.label).toBe('API/Backend');
      expect(badge.icon).toBe('⚙️');
    });

    it('classifies config, environment, and asset files correctly', () => {
      expect(getFileCategory('.env.example')).toBe('config');
      expect(getFileCategory('package.json')).toBe('config');
      expect(getFileCategory('docker-compose.yml')).toBe('config');
      expect(getFileCategory('public/logo.svg')).toBe('config');

      const badge = getCategoryBadge('config');
      expect(badge.label).toBe('Config');
      expect(badge.icon).toBe('📄');
    });

    it('classifies markdown and documentation files correctly', () => {
      expect(getFileCategory('README.md')).toBe('doc');
      expect(getFileCategory('docs/ARCHITECTURE.md')).toBe('doc');

      const badge = getCategoryBadge('doc');
      expect(badge.label).toBe('Docs');
      expect(badge.icon).toBe('📝');
    });
  });

  describe('Checkpoint Diff Preview (Visual Consequence Preview)', () => {
    let testRepoPath: string;
    let client: GitClient;
    let snapshotManager: SnapshotManager;
    let checkpointWizard: CheckpointWizard;

    beforeEach(async () => {
      testRepoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-safety-test-'));
      execSync('git init -b main', { cwd: testRepoPath });
      execSync('git config user.name "Test Runner"', { cwd: testRepoPath });
      execSync('git config user.email "test@example.com"', { cwd: testRepoPath });

      // Create initial files
      fs.writeFileSync(path.join(testRepoPath, 'app.tsx'), 'export const App = () => <div>Hello</div>;');
      fs.writeFileSync(path.join(testRepoPath, 'server.ts'), 'console.log("server");');
      execSync('git add . && git commit -m "initial commit"', { cwd: testRepoPath });

      client = new GitClient(testRepoPath);
      snapshotManager = new SnapshotManager(client);
      checkpointWizard = new CheckpointWizard(client, snapshotManager);
    });

    afterEach(() => {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    });

    it('returns exact list of affected files with status for rewind consequence preview', async () => {
      // 1. Capture safety checkpoint
      const checkpoint = await checkpointWizard.saveCheckpoint('before-ai-edits');

      // 2. Modify files and add a new one
      fs.writeFileSync(path.join(testRepoPath, 'app.tsx'), 'export const App = () => <div>Modified</div>;');
      fs.writeFileSync(path.join(testRepoPath, 'new-component.tsx'), 'export const Card = () => <div>Card</div>;');

      // 3. Query diff preview
      const diffFiles = await checkpointWizard.getDiffWithCurrent(checkpoint.id);

      expect(diffFiles.length).toBeGreaterThanOrEqual(1);
      const appFile = diffFiles.find(f => f.path === 'app.tsx');
      expect(appFile).toBeDefined();
      expect(appFile?.status).toBe('modified');

      // Verify category tagging can be applied to diff files
      const cat = getFileCategory(appFile!.path);
      expect(cat).toBe('ui');
    });
  });
});

