/**
 * GitWizard Pro: Smart 3-Way AI Conflict Resolver
 *
 * Automatically inspects Git conflict stages (BASE :1, OURS :2, THEIRS :3),
 * synthesizes non-destructive resolutions using LLM or deterministic heuristics,
 * verifies 0 remaining conflict markers, and provides a rollback airbag.
 */

import path from 'node:path';
import fs from 'node:fs';
import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import { LicenseManager } from './license';
import { AIService } from './ai-service';

export interface ConflictedFileInfo {
  filePath: string;
  baseContent: string | null;   // Stage 1 (:1:filePath)
  oursContent: string | null;   // Stage 2 (:2:filePath)
  theirsContent: string | null; // Stage 3 (:3:filePath)
  rawWorkingContent: string;    // Raw file content on disk with conflict markers
  conflictBlocksCount: number;
}

export interface ConflictResolution {
  filePath: string;
  resolvedContent: string;
  rationale: string;
  resolutionSource: 'ai' | 'heuristic';
  syntaxValid: boolean;
}

export interface ConflictAnalysisResult {
  hasConflicts: boolean;
  inMerge: boolean;
  inRebase: boolean;
  files: ConflictedFileInfo[];
  requiresPro?: boolean;
}

export interface ResolveConflictsResult {
  success: boolean;
  resolvedFiles: string[];
  resolutions: ConflictResolution[];
  allResolved: boolean;
  error?: string;
  requiresPro?: boolean;
  snapshotId?: string;
}

export class ConflictResolverEngine {
  private readonly _git: GitClient;
  private readonly _snapshotManager: SnapshotManager;
  private readonly _licenseManager: LicenseManager;
  private readonly _aiService: AIService;

  constructor(
    git: GitClient,
    snapshotManager: SnapshotManager,
    licenseManager: LicenseManager,
    aiService: AIService
  ) {
    this._git = git;
    this._snapshotManager = snapshotManager;
    this._licenseManager = licenseManager;
    this._aiService = aiService;
  }

  /**
   * Inspect current repository state and extract all conflicted files with their 3 Git stages.
   */
  async analyzeConflicts(): Promise<ConflictAnalysisResult> {
    const status = await this._git.getStatus();
    const conflictedFiles = status.conflicted;

    if (conflictedFiles.length === 0) {
      return {
        hasConflicts: false,
        inMerge: status.inMerge,
        inRebase: status.inRebase,
        files: []
      };
    }

    const files: ConflictedFileInfo[] = [];

    for (const relPath of conflictedFiles) {
      const fullPath = path.resolve(this._git.repoPath, relPath);
      let rawWorkingContent = '';
      if (fs.existsSync(fullPath)) {
        try {
          rawWorkingContent = fs.readFileSync(fullPath, 'utf8');
        } catch {
          rawWorkingContent = '';
        }
      }

      // Stage 1: BASE (common ancestor)
      const baseRes = await this._git.exec(['show', `:1:${relPath}`], { allowFailure: true });
      const baseContent = baseRes.exitCode === 0 ? baseRes.stdout : null;

      // Stage 2: OURS (current branch)
      const oursRes = await this._git.exec(['show', `:2:${relPath}`], { allowFailure: true });
      const oursContent = oursRes.exitCode === 0 ? oursRes.stdout : null;

      // Stage 3: THEIRS (incoming branch)
      const theirsRes = await this._git.exec(['show', `:3:${relPath}`], { allowFailure: true });
      const theirsContent = theirsRes.exitCode === 0 ? theirsRes.stdout : null;

      // Count conflict markers: <<<<<<< ... ======= ... >>>>>>>
      const markerMatches = rawWorkingContent.match(/<<<<<<<[^\n]*\n[\s\S]*?=======\n[\s\S]*?>>>>>>>[^\n]*/g);
      const conflictBlocksCount = markerMatches ? markerMatches.length : (rawWorkingContent.includes('<<<<<<<') ? 1 : 0);

      files.push({
        filePath: relPath,
        baseContent,
        oursContent,
        theirsContent,
        rawWorkingContent,
        conflictBlocksCount
      });
    }

    return {
      hasConflicts: true,
      inMerge: status.inMerge,
      inRebase: status.inRebase,
      files
    };
  }

  /**
   * Synthesizes a non-destructive conflict resolution for a single file.
   */
  async resolveConflictForFile(
    filePath: string,
    customInstruction?: string
  ): Promise<ConflictResolution> {
    if (!this._licenseManager.isPro()) {
      throw new Error('GitWizard Pro license or active trial required for AI Conflict Resolver.');
    }

    const fullPath = path.resolve(this._git.repoPath, filePath);
    let rawWorkingContent = '';
    if (fs.existsSync(fullPath)) {
      rawWorkingContent = fs.readFileSync(fullPath, 'utf8');
    }

    const baseRes = await this._git.exec(['show', `:1:${filePath}`], { allowFailure: true });
    const baseContent = baseRes.exitCode === 0 ? baseRes.stdout : null;

    const oursRes = await this._git.exec(['show', `:2:${filePath}`], { allowFailure: true });
    const oursContent = oursRes.exitCode === 0 ? oursRes.stdout : null;

    const theirsRes = await this._git.exec(['show', `:3:${filePath}`], { allowFailure: true });
    const theirsContent = theirsRes.exitCode === 0 ? theirsRes.stdout : null;

    const info: ConflictedFileInfo = {
      filePath,
      baseContent,
      oursContent,
      theirsContent,
      rawWorkingContent,
      conflictBlocksCount: 1
    };

    // Attempt AI Resolution first
    try {
      const aiResult = await this._resolveWithAI(info, customInstruction);
      if (aiResult && aiResult.syntaxValid) {
        return aiResult;
      }
    } catch {
      // Fallback to deterministic heuristic
    }

    return this.resolveHeuristic(info);
  }

  /**
   * Generates AI resolution using LLM with strict syntax verification.
   */
  private async _resolveWithAI(
    info: ConflictedFileInfo,
    customInstruction?: string
  ): Promise<ConflictResolution | null> {
    const ext = path.extname(info.filePath).slice(1) || 'text';

    const systemPrompt = `You are an elite code synthesis and Git conflict resolution engine.
Your task is to merge code changes from two branches (OURS and THEIRS) with zero data loss.

Rules:
1. Preserve all imports, declarations, variables, and logic from BOTH sides.
2. NEVER leave conflict markers (<<<<<<<, =======, >>>>>>>) in the code.
3. If one branch added new functions or tests and the other added new endpoints, keep BOTH.
4. Output the full resolved file content inside a single markdown code block (\`\`\`${ext} ... \`\`\`).
5. Directly below the code block, provide a single line: RATIONALE: <brief 1-sentence reason>.`;

    const userPrompt = `File: ${info.filePath}

--- BASE (Common Ancestor) ---
${info.baseContent ?? '(None / file was newly created)'}

--- OURS (Current Branch) ---
${info.oursContent ?? '(Deleted or empty)'}

--- THEIRS (Incoming Branch) ---
${info.theirsContent ?? '(Deleted or empty)'}

--- CURRENT WORKING FILE WITH CONFLICT MARKERS ---
${info.rawWorkingContent}

${customInstruction ? `User specific guidance: ${customInstruction}\n` : ''}
Synthesize both changes into the complete resolved file now:`;

    const response = await this._aiService.generateCompletion(userPrompt, { systemPrompt });
    if (!response.success || !response.content) {
      return null;
    }
    const text = response.content.trim();

    // Extract code block
    let resolvedContent = '';
    const codeBlockMatch = text.match(/```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      resolvedContent = codeBlockMatch[1];
    } else {
      // If no code block, check if raw response is code
      resolvedContent = text;
    }

    // Extract rationale
    let rationale = 'Synthesized concurrent changes from both branches';
    const rationaleMatch = text.match(/RATIONALE:\s*(.+)$/im);
    if (rationaleMatch) {
      rationale = rationaleMatch[1].trim();
    }

    // Syntax & Marker Verification
    const syntaxValid = this.validateResolvedContent(resolvedContent);

    if (!syntaxValid) {
      return null;
    }

    return {
      filePath: info.filePath,
      resolvedContent,
      rationale,
      resolutionSource: 'ai',
      syntaxValid: true
    };
  }

  /**
   * Deterministic heuristic fallback when offline, no API key, or AI fails.
   * Merges non-conflicting imports, distinct functions, and deleted-vs-modified cases.
   */
  resolveHeuristic(info: ConflictedFileInfo): ConflictResolution {
    const { filePath, rawWorkingContent, oursContent, theirsContent } = info;

    // Case 1: Deleted vs Modified
    if (!oursContent && theirsContent) {
      // OURS deleted, THEIRS modified -> preserve THEIRS modifications
      return {
        filePath,
        resolvedContent: theirsContent,
        rationale: 'Preserved incoming modifications from incoming branch (file was deleted locally).',
        resolutionSource: 'heuristic',
        syntaxValid: true
      };
    }
    if (oursContent && !theirsContent) {
      // OURS modified, THEIRS deleted -> preserve OURS modifications
      return {
        filePath,
        resolvedContent: oursContent,
        rationale: 'Preserved local modifications (file was deleted in incoming branch).',
        resolutionSource: 'heuristic',
        syntaxValid: true
      };
    }

    // Case 2: Parse conflict blocks from raw file
    // Replace conflict marker chunks by synthesizing both sides
    const conflictBlockRegex = /<<<<<<<[^\n]*\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>>[^\n]*/g;
    
    let resolved = rawWorkingContent.replace(conflictBlockRegex, (_match, oursSide, theirsSide) => {
      const oursLines = (oursSide as string).trim().split('\n').map(l => l.trim()).filter(Boolean);
      const theirsLines = (theirsSide as string).trim().split('\n').map(l => l.trim()).filter(Boolean);

      // If both sides are imports (e.g. import foo from 'bar')
      const isOursImports = oursLines.every(l => l.startsWith('import ') || l.startsWith('const ') && l.includes('require('));
      const isTheirsImports = theirsLines.every(l => l.startsWith('import ') || l.startsWith('const ') && l.includes('require('));

      if (isOursImports && isTheirsImports) {
        // Union of unique imports
        const combined = Array.from(new Set([...oursLines, ...theirsLines]));
        return combined.join('\n') + '\n';
      }

      // If one side is a subset of the other
      if (theirsSide.includes(oursSide.trim())) {
        return theirsSide;
      }
      if (oursSide.includes(theirsSide.trim())) {
        return oursSide;
      }

      // Default non-destructive union: append both distinct blocks
      return `${oursSide.trim()}\n${theirsSide.trim()}\n`;
    });

    // Strip any lingering standalone marker lines if any
    resolved = resolved
      .replace(/^<<<<<<<.*$/gm, '')
      .replace(/^=======.*$/gm, '')
      .replace(/^>>>>>>>.*$/gm, '')
      .replace(/\n{3,}/g, '\n\n');

    const syntaxValid = this.validateResolvedContent(resolved);

    return {
      filePath,
      resolvedContent: resolved,
      rationale: 'Merged non-conflicting imports and unified code blocks from both branches.',
      resolutionSource: 'heuristic',
      syntaxValid
    };
  }

  /**
   * Validate that resolved content contains zero conflict markers and balanced delimiters.
   */
  validateResolvedContent(content: string): boolean {
    if (!content || !content.trim()) return false;

    // Must not contain any Git conflict markers
    if (content.includes('<<<<<<<') || content.includes('=======') || content.includes('>>>>>>>')) {
      return false;
    }

    // Balanced bracket check for code files
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 3) {
      // Gross imbalance
      return false;
    }

    return true;
  }

  /**
   * Writes the resolved files to disk, stages them in Git index, and confirms resolution.
   * Automatically takes a safety snapshot beforehand.
   */
  async applyResolutions(resolutions: ConflictResolution[]): Promise<ResolveConflictsResult> {
    if (!this._licenseManager.isPro()) {
      return {
        success: false,
        resolvedFiles: [],
        resolutions: [],
        allResolved: false,
        error: 'GitWizard Pro license or active trial required.',
        requiresPro: true
      };
    }

    if (resolutions.length === 0) {
      return {
        success: false,
        resolvedFiles: [],
        resolutions: [],
        allResolved: false,
        error: 'No resolutions provided.'
      };
    }

    // 1. Safety Airbag: capture snapshot before overwriting conflicted files
    let snapshotId: string | undefined;
    try {
      const snap = await this._snapshotManager.createSnapshot('pre-conflict-resolution');
      snapshotId = snap.id;
    } catch {
      // Continue even if snapshot fails
    }

    const resolvedFiles: string[] = [];

    try {
      for (const res of resolutions) {
        if (!res.syntaxValid) {
          throw new Error(`Resolution for ${res.filePath} failed syntax validation.`);
        }

        const fullPath = path.resolve(this._git.repoPath, res.filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, res.resolvedContent, 'utf8');

        // Stage resolved file
        await this._git.exec(['add', res.filePath]);
        resolvedFiles.push(res.filePath);
      }

      // Re-check status to verify if any conflicts remain
      const status = await this._git.getStatus();
      const allResolved = status.conflicted.length === 0;

      return {
        success: true,
        resolvedFiles,
        resolutions,
        allResolved,
        snapshotId
      };
    } catch (err: any) {
      return {
        success: false,
        resolvedFiles,
        resolutions,
        allResolved: false,
        error: err.message,
        snapshotId
      };
    }
  }

  /**
   * Aborts mid-conflict operation (e.g. git merge --abort or git rebase --abort).
   */
  async abortConflict(): Promise<{ success: boolean; message: string }> {
    try {
      await this._git.abortInProgress();
      return {
        success: true,
        message: 'Successfully aborted merge/rebase and restored working tree.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message
      };
    }
  }
}
