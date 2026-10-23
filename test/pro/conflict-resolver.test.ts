import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { GitClient } from '../../src/engine/git-client';
import { SnapshotManager } from '../../src/engine/snapshot';
import { LicenseManager } from '../../src/pro/license';
import { AIService } from '../../src/pro/ai-service';
import { ConflictResolverEngine } from '../../src/pro/conflict-resolver';

describe('ConflictResolverEngine (Sprint 10)', () => {
  let tempDir: string;
  let git: GitClient;
  let snapshotManager: SnapshotManager;
  let licenseManager: LicenseManager;
  let aiService: AIService;
  let resolver: ConflictResolverEngine;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-conflict-test-'));
    git = new GitClient(tempDir);

    // Initialize git repository
    await git.exec(['init']);
    await git.exec(['checkout', '-b', 'main'], { allowFailure: true });
    await git.exec(['config', 'user.name', 'GitWizard Test']);
    await git.exec(['config', 'user.email', 'test@gitwizard.dev']);
    await git.exec(['config', 'commit.gpgsign', 'false']);

    snapshotManager = new SnapshotManager(git);
    licenseManager = new LicenseManager();
    const key = LicenseManager.generateKey('test@gitwizard.dev');
    licenseManager.activateLicense(key);

    aiService = new AIService({
      provider: 'gemini',
      apiKey: 'test-key'
    });

    resolver = new ConflictResolverEngine(git, snapshotManager, licenseManager, aiService);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detects clean repo with zero conflicts', async () => {
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'hello');
    await git.exec(['add', '.']);
    await git.exec(['commit', '-m', 'initial']);

    const analysis = await resolver.analyzeConflicts();
    expect(analysis.hasConflicts).toBe(false);
    expect(analysis.files).toHaveLength(0);
  });

  it('analyzes real git merge conflict and extracts stages', async () => {
    // Initial commit on main
    fs.writeFileSync(path.join(tempDir, 'code.ts'), 'export const version = 1;\n');
    await git.exec(['add', '.']);
    await git.exec(['commit', '-m', 'base version']);

    // Create feature-a and modify code.ts
    await git.exec(['checkout', '-b', 'feature-a']);
    fs.writeFileSync(path.join(tempDir, 'code.ts'), 'export const version = 2;\nexport const author = "Alice";\n');
    await git.exec(['add', '.']);
    await git.exec(['commit', '-m', 'Alice changes']);

    // Create feature-b and modify code.ts differently
    await git.exec(['checkout', 'main']);
    await git.exec(['checkout', '-b', 'feature-b']);
    fs.writeFileSync(path.join(tempDir, 'code.ts'), 'export const version = 3;\nexport const author = "Bob";\n');
    await git.exec(['add', '.']);
    await git.exec(['commit', '-m', 'Bob changes']);

    // Merge feature-a into feature-b -> causes merge conflict
    const mergeRes = await git.exec(['merge', 'feature-a'], { allowFailure: true });
    expect(mergeRes.exitCode).not.toBe(0);

    const analysis = await resolver.analyzeConflicts();
    expect(analysis.hasConflicts).toBe(true);
    expect(analysis.inMerge).toBe(true);
    expect(analysis.files).toHaveLength(1);

    const f = analysis.files[0];
    expect(f.filePath).toBe('code.ts');
    expect(f.baseContent).toContain('export const version = 1;');
    expect(f.oursContent).toContain('Bob');
    expect(f.theirsContent).toContain('Alice');
    expect(f.rawWorkingContent).toContain('<<<<<<<');
    expect(f.rawWorkingContent).toContain('=======');
    expect(f.rawWorkingContent).toContain('>>>>>>>');
  });

  it('synthesizes conflict resolution via mocked AI service', async () => {
    const conflictedContent = `<<<<<<< HEAD
export function login() { return "bob"; }
=======
export function login() { return "alice"; }
export function logout() { return true; }
>>>>>>> feature-a
`;
    fs.writeFileSync(path.join(tempDir, 'auth.ts'), conflictedContent);

    // Mock AI service
    const resolvedCode = `export function login(user?: string) { return user || "alice"; }\nexport function logout() { return true; }\n`;
    vi.spyOn(aiService, 'generateCompletion').mockResolvedValue({
      success: true,
      content: `\`\`\`typescript\n${resolvedCode}\`\`\`\nRATIONALE: Merged login parameter and added logout function.`,
      provider: 'gemini',
      model: 'gemini-1.5-flash'
    });

    const resolution = await resolver.resolveConflictForFile('auth.ts');
    expect(resolution.resolutionSource).toBe('ai');
    expect(resolution.syntaxValid).toBe(true);
    expect(resolution.resolvedContent).toBe(resolvedCode);
    expect(resolution.resolvedContent).not.toContain('<<<<<<<');
    expect(resolution.rationale).toContain('Merged login parameter');
  });

  it('falls back to deterministic heuristic for imports union when AI fails', async () => {
    const conflictedContent = `<<<<<<< HEAD
import { userApi } from './api/user';
import { authService } from './services/auth';
=======
import { billingApi } from './api/billing';
import { userApi } from './api/user';
>>>>>>> incoming
`;
    fs.writeFileSync(path.join(tempDir, 'imports.ts'), conflictedContent);

    // Force AI failure
    vi.spyOn(aiService, 'generateCompletion').mockResolvedValue({
      success: false,
      content: '',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      error: 'AI rate limited'
    });

    const resolution = await resolver.resolveConflictForFile('imports.ts');
    expect(resolution.resolutionSource).toBe('heuristic');
    expect(resolution.syntaxValid).toBe(true);
    expect(resolution.resolvedContent).not.toContain('<<<<<<<');
    expect(resolution.resolvedContent).toContain("import { userApi } from './api/user';");
    expect(resolution.resolvedContent).toContain("import { authService } from './services/auth';");
    expect(resolution.resolvedContent).toContain("import { billingApi } from './api/billing';");
  });

  it('validates syntax and detects lingering conflict markers or braces', () => {
    expect(resolver.validateResolvedContent('const a = 1;')).toBe(true);
    expect(resolver.validateResolvedContent('<<<<<<< HEAD\nconst a = 1;')).toBe(false);
    expect(resolver.validateResolvedContent('const a = 1;\n=======\n')).toBe(false);
    expect(resolver.validateResolvedContent('>>>>>>> branch')).toBe(false);
    expect(resolver.validateResolvedContent('')).toBe(false);
    expect(resolver.validateResolvedContent('function test() { { { {')).toBe(false); // severely unbalanced
  });

  it('applies resolution, stages file, and captures safety snapshot', async () => {
    fs.writeFileSync(path.join(tempDir, 'test.ts'), 'base');
    await git.exec(['add', '.']);
    await git.exec(['commit', '-m', 'init']);

    fs.writeFileSync(path.join(tempDir, 'test.ts'), '<<<<<<< HEAD\nfoo\n=======\nbar\n>>>>>>>');

    const resolution = {
      filePath: 'test.ts',
      resolvedContent: 'export const foobar = true;\n',
      rationale: 'Combined foo and bar',
      resolutionSource: 'heuristic' as const,
      syntaxValid: true
    };

    const res = await resolver.applyResolutions([resolution]);
    expect(res.success).toBe(true);
    expect(res.resolvedFiles).toContain('test.ts');
    expect(res.snapshotId).toBeDefined();

    // Verify file content on disk
    const contentOnDisk = fs.readFileSync(path.join(tempDir, 'test.ts'), 'utf8');
    expect(contentOnDisk).toBe('export const foobar = true;\n');
  });

  it('enforces Pro licensing check on conflict resolution', async () => {
    // Expire trial and clear licenses
    vi.spyOn(licenseManager, 'isPro').mockReturnValue(false);

    await expect(resolver.resolveConflictForFile('any.ts')).rejects.toThrow(/GitWizard Pro/);

    const applyRes = await resolver.applyResolutions([{
      filePath: 'any.ts',
      resolvedContent: 'code',
      rationale: 'test',
      resolutionSource: 'heuristic',
      syntaxValid: true
    }]);

    expect(applyRes.success).toBe(false);
    expect(applyRes.requiresPro).toBe(true);
  });
});
