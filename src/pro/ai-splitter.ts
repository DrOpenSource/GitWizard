/**
 * GitWizard Pro: Semantic AI Multi-Branch Auto-Splitter
 * Automatically clusters 10-20 tangled files from massive AI coding sessions
 * into 2-3 clean, reviewable branches with semantic commit messages.
 */

import { GitClient } from '../engine/git-client';
import { AIService } from './ai-service';
import { LicenseManager } from './license';
import { BranchSplitterWizard, SplitResult } from '../wizards/split';

export interface SplitClusterGroup {
  branchName: string;
  commitMessage: string;
  rationale: string;
  files: string[];
}

export interface AutoSplitPlanResult {
  success: boolean;
  groups: SplitClusterGroup[];
  totalFiles: number;
  error?: string;
  requiresPro?: boolean;
}

export class AISplitterEngine {
  private git: GitClient;
  private aiService: AIService;
  private licenseManager: LicenseManager;
  private splitterWizard?: BranchSplitterWizard;

  constructor(
    git: GitClient,
    aiService: AIService,
    licenseManager: LicenseManager,
    splitterWizard?: BranchSplitterWizard
  ) {
    this.git = git;
    this.aiService = aiService;
    this.licenseManager = licenseManager;
    this.splitterWizard = splitterWizard;
  }

  /**
   * Plans an AI-driven multi-branch split across all dirty files.
   */
  async planAutoSplit(): Promise<AutoSplitPlanResult> {
    // 1. Pro License / Trial check
    const licStatus = this.licenseManager.getStatus();
    if (!licStatus.isPro) {
      return {
        success: false,
        groups: [],
        totalFiles: 0,
        requiresPro: true,
        error: licStatus.reason || 'GitWizard Pro license or active trial required for AI Auto-Splitter.'
      };
    }

    // 2. Inspect dirty files
    const status = await this.git.getStatus();
    const allFiles = Array.from(new Set([...status.staged, ...status.modified, ...status.untracked]))
      .filter(f => !f.endsWith('-lock.json') && !f.endsWith('.lock'));

    if (allFiles.length === 0) {
      return {
        success: false,
        groups: [],
        totalFiles: 0,
        error: 'No modified or untracked files found. Working tree is clean!'
      };
    }

    if (allFiles.length === 1) {
      return {
        success: false,
        groups: [],
        totalFiles: 1,
        error: `Only 1 file is modified ('${allFiles[0]}'). Splitting requires multiple files.`
      };
    }

    // 3. Try AI clustering via LLM, fallback to heuristic clustering
    try {
      const groups = await this.clusterWithAI(allFiles);
      return {
        success: true,
        groups,
        totalFiles: allFiles.length
      };
    } catch {
      // Offline or error fallback: deterministic structural heuristic
      const fallbackGroups = this.clusterHeuristically(allFiles);
      return {
        success: true,
        groups: fallbackGroups,
        totalFiles: allFiles.length
      };
    }
  }

  /**
   * Executes the auto-split plan into actual branches using BranchSplitterWizard.
   */
  async executeAutoSplit(groups: SplitClusterGroup[]): Promise<SplitResult> {
    if (!this.splitterWizard) {
      throw new Error('BranchSplitterWizard instance not provided to AISplitterEngine.');
    }

    return await this.splitterWizard.splitChanges({
      groups: groups.map(g => ({
        branchName: g.branchName,
        commitMessage: g.commitMessage,
        files: g.files
      }))
    });
  }

  /**
   * Clusters files using LLM reasoning.
   */
  private async clusterWithAI(files: string[]): Promise<SplitClusterGroup[]> {
    const prompt = `Analyze this list of modified files in a repository and divide them into 2 to 3 logical, decoupled pull request groups (e.g. backend/API vs frontend/UI vs docs/tests).

Files:
${files.map(f => `- ${f}`).join('\n')}

Respond strictly with valid JSON conforming to this schema (no extra commentary or markdown fencing):
[
  {
    "branchName": "feature/branch-name",
    "commitMessage": "feat(scope): concise description",
    "rationale": "One sentence reason for grouping",
    "files": ["file1.ts", "file2.tsx"]
  }
]`;

    const response = await this.aiService.generateCompletion(prompt, {
      systemPrompt: 'You are an expert Git architect. Organize messy multi-file AI coding edits into clean, atomic feature branches. Respond only in raw JSON.'
    });

    if (!response.success || !response.content) {
      throw new Error('AI response unsuccessful');
    }

    // Parse JSON
    let clean = response.content.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed: SplitClusterGroup[] = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid JSON structure returned by AI');
    }

    // Validate that all returned files are valid and all original files are accounted for
    const assignedFiles = new Set<string>();
    for (const group of parsed) {
      for (const f of group.files) {
        assignedFiles.add(f);
      }
    }

    // If any original files were omitted by the LLM, assign them to the first group
    const missing = files.filter(f => !assignedFiles.has(f));
    if (missing.length > 0 && parsed.length > 0) {
      parsed[0].files.push(...missing);
    }

    return parsed;
  }

  /**
   * Deterministic heuristic clustering fallback when offline or no API key.
   */
  clusterHeuristically(files: string[]): SplitClusterGroup[] {
    const frontendFiles: string[] = [];
    const backendFiles: string[] = [];

    for (const f of files) {
      const lower = f.toLowerCase();
      if (
        lower.includes('webview') ||
        lower.includes('frontend') ||
        lower.includes('components') ||
        lower.includes('ui') ||
        lower.endsWith('.css') ||
        lower.endsWith('.tsx') ||
        lower.endsWith('.jsx') ||
        lower.endsWith('.html')
      ) {
        frontendFiles.push(f);
      } else {
        backendFiles.push(f);
      }
    }

    // If all files landed in one bucket, split in half
    if (frontendFiles.length === 0 || backendFiles.length === 0) {
      const half = Math.ceil(files.length / 2);
      return [
        {
          branchName: 'feature/part-1-core',
          commitMessage: 'feat(core): initial batch of changes',
          rationale: 'Primary core components and foundation',
          files: files.slice(0, half)
        },
        {
          branchName: 'feature/part-2-features',
          commitMessage: 'feat(features): supplementary changes',
          rationale: 'Secondary features and integrations',
          files: files.slice(half)
        }
      ];
    }

    return [
      {
        branchName: 'feature/frontend-ui',
        commitMessage: 'feat(ui): frontend components and view updates',
        rationale: 'User interface components, styling, and client views',
        files: frontendFiles
      },
      {
        branchName: 'feature/backend-core',
        commitMessage: 'feat(core): backend logic and engines',
        rationale: 'Business logic, services, and server handlers',
        files: backendFiles
      }
    ];
  }
}
