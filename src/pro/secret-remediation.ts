/**
 * GitWizard Pro: 1-Click Secret Remediation Engine
 * Safely extracts exposed secrets into `.env`, updates `.gitignore`,
 * and replaces plaintext keys in source files with `process.env.VARIABLE_NAME`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DetectedSecret } from './secret-scanner';

export interface RemediationOptions {
  envFileName?: string; // Defaults to '.env'
  gitIgnoreFileName?: string; // Defaults to '.gitignore'
  varNamePrefix?: string; // Optional prefix e.g. 'VITE_' or ''
}

export interface RemediatedSecretResult {
  secret: DetectedSecret;
  variableName: string;
  sourceFileUpdated: boolean;
  envUpdated: boolean;
  gitignoreUpdated: boolean;
}

export interface RemediationBatchResult {
  success: boolean;
  remediated: RemediatedSecretResult[];
  error?: string;
}

export class SecretRemediationEngine {
  private repoRoot: string;
  private options: RemediationOptions;

  constructor(repoRoot: string, options: RemediationOptions = {}) {
    this.repoRoot = repoRoot;
    this.options = {
      envFileName: options.envFileName || '.env',
      gitIgnoreFileName: options.gitIgnoreFileName || '.gitignore',
      varNamePrefix: options.varNamePrefix || ''
    };
  }

  /**
   * Generates a descriptive, idiomatic UPPER_CASE variable name for a secret.
   */
  suggestVariableName(secret: DetectedSecret): string {
    let base = 'API_SECRET';
    switch (secret.ruleId) {
      case 'openai-api-key':
        base = 'OPENAI_API_KEY';
        break;
      case 'anthropic-api-key':
        base = 'ANTHROPIC_API_KEY';
        break;
      case 'google-api-key':
        base = 'GEMINI_API_KEY';
        break;
      case 'stripe-live-secret':
      case 'stripe-test-key':
        base = 'STRIPE_SECRET_KEY';
        break;
      case 'stripe-live-restricted':
        base = 'STRIPE_RESTRICTED_KEY';
        break;
      case 'aws-access-key-id':
        base = 'AWS_ACCESS_KEY_ID';
        break;
      case 'github-pat':
        base = 'GITHUB_TOKEN';
        break;
      case 'slack-token':
        base = 'SLACK_BOT_TOKEN';
        break;
      case 'database-url-credentials':
        base = 'DATABASE_URL';
        break;
      default:
        base = 'SECRET_TOKEN';
    }

    const prefix = this.options.varNamePrefix || '';
    return `${prefix}${base}`;
  }

  /**
   * Remediates a list of detected secrets atomically.
   */
  remediateSecrets(secrets: DetectedSecret[]): RemediationBatchResult {
    if (!secrets || secrets.length === 0) {
      return { success: true, remediated: [] };
    }

    const backupMap = new Map<string, string | null>(); // path -> originalContent (null if did not exist)
    const envPath = path.join(this.repoRoot, this.options.envFileName || '.env');
    const gitignorePath = path.join(this.repoRoot, this.options.gitIgnoreFileName || '.gitignore');

    try {
      // 1. Snapshot all target files for atomic rollback
      this.backupFile(envPath, backupMap);
      this.backupFile(gitignorePath, backupMap);

      for (const s of secrets) {
        const fullSourcePath = path.isAbsolute(s.file) ? s.file : path.join(this.repoRoot, s.file);
        this.backupFile(fullSourcePath, backupMap);
      }

      // 2. Ensure .gitignore has .env
      const gitignoreUpdated = this.ensureGitIgnored(gitignorePath);

      // 3. Process each secret
      const results: RemediatedSecretResult[] = [];
      const usedVarNames = new Set<string>();

      for (const secret of secrets) {
        let varName = this.suggestVariableName(secret);
        // Deduplicate variable names if multiple of same type
        if (usedVarNames.has(varName)) {
          let counter = 2;
          while (usedVarNames.has(`${varName}_${counter}`)) {
            counter++;
          }
          varName = `${varName}_${counter}`;
        }
        usedVarNames.add(varName);

        // Append or update in .env
        const envUpdated = this.appendOrUpdateEnv(envPath, varName, secret.rawSecret);

        // Replace literal in source file
        const fullSourcePath = path.isAbsolute(secret.file) ? secret.file : path.join(this.repoRoot, secret.file);
        const sourceFileUpdated = this.replaceInSource(fullSourcePath, secret.rawSecret, varName);

        results.push({
          secret,
          variableName: varName,
          sourceFileUpdated,
          envUpdated,
          gitignoreUpdated
        });
      }

      return {
        success: true,
        remediated: results
      };
    } catch (err: any) {
      // Rollback on any failure
      this.rollback(backupMap);
      return {
        success: false,
        remediated: [],
        error: `Remediation failed, restored original files: ${err.message}`
      };
    }
  }

  private backupFile(filePath: string, backupMap: Map<string, string | null>): void {
    if (!backupMap.has(filePath)) {
      if (fs.existsSync(filePath)) {
        backupMap.set(filePath, fs.readFileSync(filePath, 'utf-8'));
      } else {
        backupMap.set(filePath, null);
      }
    }
  }

  private rollback(backupMap: Map<string, string | null>): void {
    for (const [filePath, content] of backupMap.entries()) {
      try {
        if (content === null) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } else {
          fs.writeFileSync(filePath, content, 'utf-8');
        }
      } catch (err) {
        console.error(`Failed to rollback file ${filePath}:`, err);
      }
    }
  }

  private ensureGitIgnored(gitignorePath: string): boolean {
    const entryToIgnore = this.options.envFileName || '.env';

    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, `${entryToIgnore}\n`, 'utf-8');
      return true;
    }

    const currentContent = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = currentContent.split('\n').map(l => l.trim());

    // Check if .env or *.env is already ignored
    const isAlreadyIgnored = lines.some(l => l === entryToIgnore || l === `*.${entryToIgnore.replace(/^\./, '')}` || l === `${entryToIgnore}*`);
    if (isAlreadyIgnored) {
      return false;
    }

    const separator = currentContent.endsWith('\n') || currentContent.length === 0 ? '' : '\n';
    fs.writeFileSync(gitignorePath, `${currentContent}${separator}${entryToIgnore}\n`, 'utf-8');
    return true;
  }

  private appendOrUpdateEnv(envPath: string, varName: string, secretValue: string): boolean {
    const lineToAdd = `${varName}="${secretValue}"`;

    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, `${lineToAdd}\n`, 'utf-8');
      return true;
    }

    const existingContent = fs.readFileSync(envPath, 'utf-8');
    const regex = new RegExp(`^${varName}=.*$`, 'm');

    if (regex.test(existingContent)) {
      // Replace existing value
      const updated = existingContent.replace(regex, lineToAdd);
      fs.writeFileSync(envPath, updated, 'utf-8');
      return true;
    }

    const separator = existingContent.endsWith('\n') || existingContent.length === 0 ? '' : '\n';
    fs.writeFileSync(envPath, `${existingContent}${separator}${lineToAdd}\n`, 'utf-8');
    return true;
  }

  private replaceInSource(sourceFilePath: string, rawSecret: string, varName: string): boolean {
    if (!fs.existsSync(sourceFilePath)) {
      return false;
    }

    const content = fs.readFileSync(sourceFilePath, 'utf-8');
    const replacementExpression = `process.env.${varName}`;

    // Target both single quotes and double quotes around secret: "secret" or 'secret'
    const doubleQuotePattern = `"${rawSecret}"`;
    const singleQuotePattern = `'${rawSecret}'`;
    const templateQuotePattern = `\`${rawSecret}\``;

    let updatedContent = content;

    if (updatedContent.includes(doubleQuotePattern)) {
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(doubleQuotePattern), 'g'), replacementExpression);
    } else if (updatedContent.includes(singleQuotePattern)) {
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(singleQuotePattern), 'g'), replacementExpression);
    } else if (updatedContent.includes(templateQuotePattern)) {
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(templateQuotePattern), 'g'), replacementExpression);
    } else {
      // Direct raw replace if quotes weren't included in rawSecret
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(rawSecret), 'g'), replacementExpression);
    }

    fs.writeFileSync(sourceFilePath, updatedContent, 'utf-8');
    return true;
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
