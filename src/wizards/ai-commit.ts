/**
 * GitWizard Pro: AI Commit & PR Description Wizard
 * Transforms raw, multi-file working tree diffs into conventional semantic commits
 * and clean GitHub PR descriptions with zero effort from the vibe coder.
 */

import { GitClient } from '../engine/git-client';
import { AIService } from '../pro/ai-service';
import { LicenseManager } from '../pro/license';
import fs from 'node:fs';
import path from 'node:path';

export interface AICommitResult {
  success: boolean;
  commitMessage?: string;
  summary?: string;
  error?: string;
  requiresPro?: boolean;
}

export interface AIPullRequestResult {
  success: boolean;
  title?: string;
  body?: string;
  error?: string;
  requiresPro?: boolean;
}

export class AICommitWizard {
  readonly git: GitClient;
  readonly aiService: AIService;
  readonly licenseManager: LicenseManager;

  constructor(git: GitClient, aiService: AIService, licenseManager: LicenseManager) {
    this.git = git;
    this.aiService = aiService;
    this.licenseManager = licenseManager;
  }

  /**
   * Generates a semantic conventional commit message from current working tree changes.
   */
  async generateCommitMessage(): Promise<AICommitResult> {
    // 1. Verify Pro entitlement
    const licStatus = this.licenseManager.getStatus();
    if (!licStatus.isPro) {
      return {
        success: false,
        requiresPro: true,
        error: licStatus.reason || 'GitWizard Pro license or active trial required to generate AI commits.'
      };
    }

    // 2. Check for changes
    const status = await this.git.getStatus();
    const dirtyCount = status.modified.length + status.staged.length + status.untracked.length;
    if (dirtyCount === 0) {
      return {
        success: false,
        error: 'No modified or untracked files found. Working tree is completely clean.'
      };
    }

    // 3. Extract working tree diff
    // Get diff against HEAD (includes both staged and unstaged tracked changes)
    const diffRes = await this.git.exec(['diff', 'HEAD'], { allowFailure: true });
    let combinedDiff = diffRes.exitCode === 0 ? diffRes.stdout : '';

    // If repo has no commits yet (empty HEAD), diff against index
    if (!combinedDiff) {
      const indexDiff = await this.git.exec(['diff'], { allowFailure: true });
      combinedDiff = indexDiff.stdout || '';
    }

    // Append untracked file hints
    if (status.untracked.length > 0) {
      const untrackedPreviews: string[] = [];
      for (const file of status.untracked.slice(0, 5)) {
        try {
          const fullPath = path.join(this.git.repoPath, file);
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.size < 50000) {
              const sample = fs.readFileSync(fullPath, 'utf-8').slice(0, 500);
              untrackedPreviews.push(`+++ new untracked file: ${file}\n${sample}`);
            } else {
              untrackedPreviews.push(`+++ new untracked file: ${file} (${stat.size} bytes)`);
            }
          }
        } catch {
          // ignore read errors on untracked files
        }
      }
      if (untrackedPreviews.length > 0) {
        combinedDiff += `\n\n${untrackedPreviews.join('\n\n')}`;
      }
    }

    if (!combinedDiff.trim()) {
      return {
        success: false,
        error: 'Could not extract diff details from working tree.'
      };
    }

    // 4. Prune diff to fit context window
    const prunedDiff = AIService.pruneDiff(combinedDiff);

    // 5. Prompt AI
    const systemPrompt = `You are an expert software engineer writing concise, professional Git commit messages.
Follow the Conventional Commits specification strictly:
<type>(<optional-scope>): <imperative summary>

[optional body explaining 'why' and key changes with bullet points]

Types must be one of: feat, fix, refactor, docs, chore, test, style, perf.
Output ONLY the final commit message. Do NOT wrap in markdown code fences or backticks. Keep the first line under 72 characters.`;

    const userPrompt = `Here is the git diff of changes to summarize:\n\n${prunedDiff}`;

    const aiRes = await this.aiService.generateCompletion(userPrompt, {
      systemPrompt,
      temperature: 0.2
    });

    if (!aiRes.success) {
      return {
        success: false,
        error: aiRes.error || 'AI generation failed'
      };
    }

    // Clean any accidental markdown code blocks
    let cleaned = aiRes.content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '').trim();
    }

    const firstLine = cleaned.split('\n')[0] || cleaned;

    return {
      success: true,
      commitMessage: cleaned,
      summary: firstLine
    };
  }

  /**
   * Generates a GitHub Pull Request description between current branch and base branch.
   */
  async generatePRDescription(baseBranch: string = 'main'): Promise<AIPullRequestResult> {
    const licStatus = this.licenseManager.getStatus();
    if (!licStatus.isPro) {
      return {
        success: false,
        requiresPro: true,
        error: licStatus.reason || 'GitWizard Pro license or active trial required.'
      };
    }

    const branch = await this.git.getCurrentBranch();
    const diffRes = await this.git.exec(['diff', `${baseBranch}...HEAD`], { allowFailure: true });
    
    let diff = diffRes.exitCode === 0 ? diffRes.stdout : '';
    if (!diff.trim()) {
      // Fallback: check log of commits on this branch
      const logRes = await this.git.exec(['log', `${baseBranch}..HEAD`, '--oneline'], { allowFailure: true });
      diff = logRes.stdout || '';
    }

    if (!diff.trim()) {
      return {
        success: false,
        error: `No commits found on branch '${branch}' ahead of '${baseBranch}'.`
      };
    }

    const prunedDiff = AIService.pruneDiff(diff);

    const systemPrompt = `You are a tech lead generating a structured Pull Request description for GitHub.
Output format:
TITLE: <concise PR title>
---
### 🎯 Objective
<1-2 sentences explaining what problem this PR solves>

### 🛠️ Changes Made
<bullet points of key architectural and code changes>

### 🧪 Verification
<how this was tested and verified>`;

    const aiRes = await this.aiService.generateCompletion(`Diff between ${baseBranch} and ${branch}:\n\n${prunedDiff}`, {
      systemPrompt,
      temperature: 0.2
    });

    if (!aiRes.success) {
      return {
        success: false,
        error: aiRes.error || 'Failed to generate PR description'
      };
    }

    const text = aiRes.content.trim();
    const match = text.match(/TITLE:\s*(.+?)\n---\n([\s\S]+)/);
    if (match) {
      return {
        success: true,
        title: match[1].trim(),
        body: match[2].trim()
      };
    }

    const firstLine = text.split('\n')[0] || `PR: ${branch}`;
    return {
      success: true,
      title: firstLine,
      body: text
    };
  }
}
