import * as vscode from 'vscode';
import path from 'node:path';
import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import { TransactionRunner } from '../engine/transaction';
import { CheckpointWizard } from '../wizards/checkpoint';
import { BranchSplitterWizard, SplitRequest } from '../wizards/split';
import { SafeSyncWizard } from '../wizards/sync';
import { UndoWizard } from '../wizards/undo';
import { RepoSplitterWizard, SplitToNewRepoOptions } from '../wizards/publish';
import { DailyEssentialsWizard } from '../wizards/essentials';
import { AutoCheckpointController } from '../engine/auto-checkpoint';
import { LicenseManager, LicenseStorage, LicenseStatus } from '../pro/license';
import { AIService, AIProvider, AIModelConfig } from '../pro/ai-service';
import { AICommitWizard } from '../wizards/ai-commit';
import { SecretScanner, DetectedSecret } from '../pro/secret-scanner';
import { SecretRemediationEngine } from '../pro/secret-remediation';
import { ProductionBranchGuard } from '../pro/branch-guard';
import { FileRewindEngine } from '../pro/file-rewind';
import { AISplitterEngine } from '../pro/ai-splitter';
import { ConflictResolverEngine, ConflictResolution } from '../pro/conflict-resolver';
import { CloudSyncEngine } from '../pro/cloud-sync';
import { PullRequestWizard } from '../wizards/pr';

class VSCodeLicenseStorage implements LicenseStorage {
  constructor(private readonly memento: vscode.Memento) {}
  get(key: string): string | undefined {
    return this.memento.get<string>(key);
  }
  set(key: string, value: string): void {
    this.memento.update(key, value);
  }
}

function getActiveAIConfig(): AIModelConfig {
  const config = vscode.workspace.getConfiguration('gitwizard');
  const provider = (config.get<string>('aiProvider') || 'gemini') as AIProvider;
  let apiKey = '';
  if (provider === 'gemini') {
    apiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY || '';
  } else if (provider === 'openai') {
    apiKey = config.get<string>('openaiApiKey') || process.env.OPENAI_API_KEY || '';
  }
  const baseUrl = config.get<string>('ollamaBaseUrl') || 'http://localhost:11434';
  const model = config.get<string>('ollamaModel') || (provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'llama3.2');

  return { provider, apiKey, baseUrl, model };
}


class SnapshotContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly snapshotManager: SnapshotManager) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const snapshotId = uri.authority;
    const filePath = uri.path.replace(/^\//, '');
    return await this.snapshotManager.getFileContent(snapshotId, filePath);
  }
}

class GitWizardSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitwizard.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _git: GitClient,
    private readonly _snapshotManager: SnapshotManager,
    private readonly _checkpointWizard: CheckpointWizard,
    private readonly _splitterWizard: BranchSplitterWizard,
    private readonly _syncWizard: SafeSyncWizard,
    private readonly _undoWizard: UndoWizard,
    private readonly _repoSplitterWizard: RepoSplitterWizard,
    private readonly _essentialsWizard: DailyEssentialsWizard,
    private readonly _autoCheckpoint: AutoCheckpointController,
    private readonly _licenseManager: LicenseManager,
    private readonly _aiService: AIService,
    private readonly _aiCommitWizard: AICommitWizard,
    private readonly _branchGuard: ProductionBranchGuard,
    private readonly _secretScanner: SecretScanner,
    private readonly _secretRemediation: SecretRemediationEngine,
    private readonly _fileRewind: FileRewindEngine,
    private readonly _aiSplitter: AISplitterEngine,
    private readonly _conflictResolver: ConflictResolverEngine,
    private readonly _cloudSync: CloudSyncEngine,
    private readonly _prWizard: PullRequestWizard,
    private readonly _updateStatusBar: () => Promise<void>
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'GET_STATUS': {
          await this.broadcastStatus();
          break;
        }

        case 'INIT_REPO': {
          try {
            vscode.window.showInformationMessage('GitWizard: Enabling Safe Mode...');
            const initRes = await this._git.initRepo();
            if (initRes.exitCode === 0) {
              try {
                await this._checkpointWizard.saveCheckpoint('Initial Safe Mode Baseline');
              } catch {}
              vscode.window.showInformationMessage('GitWizard: Safe Mode Enabled! 🧙‍♂️');
              this._view?.webview.postMessage({ type: 'REPO_INITIALIZED', success: true });
            } else {
              vscode.window.showErrorMessage('GitWizard Init Failed: ' + initRes.stderr);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage('GitWizard Init Error: ' + err.message);
          }
          break;
        }

        case 'GET_PRO_STATUS': {
          const proStatus = this._licenseManager.getStatus();
          this._view?.webview.postMessage({
            type: 'PRO_STATUS_UPDATE',
            proStatus
          });
          break;
        }

        case 'ACTIVATE_LICENSE': {
          try {
            const res = this._licenseManager.activateLicense(data.key || '');
            if (res.isPro) {
              vscode.window.showInformationMessage(`GitWizard Pro: Successfully activated for ${res.email}! 🎉`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Pro Activation Error: ${res.reason || 'Invalid license key'}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Activation Error: ${err.message}`);
          }
          break;
        }

        case 'GENERATE_AI_COMMIT': {
          try {
            // Refresh AI config in case user updated settings or env
            this._aiService.updateConfig(getActiveAIConfig());
            const configSummary = this._aiService.getConfigSummary();

            if (configSummary.provider !== 'ollama' && !configSummary.hasKey) {
              this._view?.webview.postMessage({
                type: 'OPEN_SETTINGS',
                reason: `Please enter your ${configSummary.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key to enable AI-powered features.`
              });
              this._view?.webview.postMessage({
                type: 'AI_COMMIT_RESPONSE',
                success: false,
                error: `Please enter your ${configSummary.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key in Settings.`
              });
              break;
            }

            const result = await this._aiCommitWizard.generateCommitMessage();
            this._view?.webview.postMessage({
              type: 'AI_COMMIT_RESPONSE',
              success: result.success,
              commitMessage: result.commitMessage,
              summary: result.summary,
              error: result.error,
              requiresPro: result.requiresPro
            });
          } catch (err: any) {
            this._view?.webview.postMessage({
              type: 'AI_COMMIT_RESPONSE',
              success: false,
              error: err.message
            });
          }
          break;
        }

        case 'CREATE_CHECKPOINT': {
          try {
            const snap = await this._checkpointWizard.saveCheckpoint(data.label || 'checkpoint');
            vscode.window.showInformationMessage(`GitWizard: Checkpoint '${snap.label}' captured!`);
            this._view?.webview.postMessage({
              type: 'CHECKPOINT_CREATED',
              snapshot: snap
            });
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Error: ${err.message}`);
            this._view?.webview.postMessage({
              type: 'CHECKPOINT_ERROR',
              error: err.message
            });
          }
          break;
        }

        case 'SHOW_WARNING': {
          if (data.message) {
            vscode.window.showWarningMessage(`GitWizard: ${data.message}`);
          }
          break;
        }

        case 'SHOW_ERROR': {
          if (data.message) {
            vscode.window.showErrorMessage(`GitWizard: ${data.message}`);
          }
          break;
        }

        case 'RESTORE_CHECKPOINT': {
          try {
            await this._checkpointWizard.restoreCheckpoint(data.snapshotId);
            vscode.window.showInformationMessage(`GitWizard: Successfully restored checkpoint!`);
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Restore Error: ${err.message}`);
          }
          break;
        }

        case 'REWIND_FILE': {
          try {
            const res = await this._fileRewind.rewindFile(data.snapshotId, data.filePath);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showErrorMessage(`GitWizard File Rewind Error: ${res.error || res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard File Rewind Error: ${err.message}`);
          }
          break;
        }

        case 'PLAN_AUTO_SPLIT': {
          try {
            this._aiService.updateConfig(getActiveAIConfig());
            const plan = await this._aiSplitter.planAutoSplit();
            this._view?.webview.postMessage({
              type: 'AUTO_SPLIT_PLAN_RESPONSE',
              plan
            });
          } catch (err: any) {
            this._view?.webview.postMessage({
              type: 'AUTO_SPLIT_PLAN_RESPONSE',
              plan: { success: false, groups: [], totalFiles: 0, error: err.message }
            });
          }
          break;
        }

        case 'EXECUTE_AUTO_SPLIT': {
          try {
            const res = await this._aiSplitter.executeAutoSplit(data.groups);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: Successfully split into ${res.createdBranches.join(', ')}! ✂️`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Auto-Split Error: ${res.error}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Auto-Split Error: ${err.message}`);
          }
          break;
        }

        case 'SPLIT_CHANGES': {
          try {
            const req: SplitRequest = data.request;
            const res = await this._splitterWizard.splitChanges(req);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: Successfully split changes into ${res.createdBranches.join(', ')}!`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Split Error: ${res.error}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Split Error: ${err.message}`);
          }
          break;
        }

        case 'ANALYZE_CONFLICTS': {
          try {
            const analysis = await this._conflictResolver.analyzeConflicts();
            this._view?.webview.postMessage({
              type: 'CONFLICT_ANALYSIS_RESPONSE',
              analysis
            });
          } catch (err: any) {
            this._view?.webview.postMessage({
              type: 'CONFLICT_ANALYSIS_RESPONSE',
              analysis: { hasConflicts: false, inMerge: false, inRebase: false, files: [], error: err.message }
            });
          }
          break;
        }

        case 'RESOLVE_CONFLICT_AI': {
          try {
            this._aiService.updateConfig(getActiveAIConfig());
            const resolution = await this._conflictResolver.resolveConflictForFile(data.filePath, data.customInstruction);
            this._view?.webview.postMessage({
              type: 'FILE_CONFLICT_RESOLVED',
              resolution
            });
          } catch (err: any) {
            this._view?.webview.postMessage({
              type: 'FILE_CONFLICT_RESOLVED',
              resolution: null,
              error: err.message
            });
          }
          break;
        }

        case 'APPLY_CONFLICT_RESOLUTIONS': {
          try {
            const res = await this._conflictResolver.applyResolutions(data.resolutions);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: Resolved conflicts in ${res.resolvedFiles.join(', ')}! 🛡️`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Conflict Error: ${res.error}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Conflict Error: ${err.message}`);
          }
          break;
        }

        case 'ABORT_CONFLICT': {
          try {
            const res = await this._conflictResolver.abortConflict();
            vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Abort Error: ${err.message}`);
          }
          break;
        }

        case 'PUSH_CLOUD_SYNC': {
          try {
            vscode.window.showInformationMessage('GitWizard: Encrypting and pushing snapshots to remote...');
            const res = await this._cloudSync.pushToCloud({ remote: data.remote || 'origin', passphrase: data.passphrase });
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Cloud Sync Error: ${res.message}`);
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Cloud Sync Error: ${err.message}`);
          }
          break;
        }

        case 'PULL_CLOUD_SYNC': {
          try {
            vscode.window.showInformationMessage('GitWizard: Pulling and decrypting cloud snapshots...');
            const res = await this._cloudSync.pullFromCloud({ remote: data.remote || 'origin', passphrase: data.passphrase });
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
              await this.broadcastStatus();
            } else {
              vscode.window.showErrorMessage(`GitWizard Cloud Sync Error: ${res.message}`);
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Cloud Sync Error: ${err.message}`);
          }
          break;
        }

        case 'SAFE_SYNC': {
          try {
            vscode.window.showInformationMessage('GitWizard: Syncing with remote safely...');
            const res = await this._syncWizard.safeSync({ strategy: data.strategy || 'rebase' });
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showWarningMessage(`GitWizard: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Sync Error: ${err.message}`);
          }
          break;
        }

        case 'UNDO_LAST': {
          try {
            const res = await this._undoWizard.undoLastAction();
            vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Undo Error: ${err.message}`);
          }
          break;
        }

        case 'GET_RECENT_ACTIONS': {
          try {
            const actions = await this._undoWizard.getRecentActions(20);
            this._view?.webview.postMessage({
              type: 'RECENT_ACTIONS_RESPONSE',
              actions
            });
          } catch (err: any) {
            console.error('Failed to get recent reflog actions:', err);
          }
          break;
        }

        case 'SPLIT_TO_NEW_REPO': {
          try {
            vscode.window.showInformationMessage(`GitWizard: Promoting '${data.options.sourceBranch}' to new repo '${data.options.newRepoName}'...`);
            const res = await this._repoSplitterWizard.splitToNewRepo(data.options);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else if (res.missingGhCli) {
              const action = await vscode.window.showWarningMessage(
                `GitWizard: GitHub CLI not detected. Would you like to create "${data.options.newRepoName}" on GitHub in your browser?`,
                'Open GitHub in Browser',
                'Cancel'
              );
              if (action === 'Open GitHub in Browser' && res.webFallbackUrl) {
                vscode.env.openExternal(vscode.Uri.parse(res.webFallbackUrl));
              }
              this._view?.webview.postMessage({
                type: 'SPLIT_REPO_FALLBACK',
                webFallbackUrl: res.webFallbackUrl,
                message: res.message
              });
            } else {
              vscode.window.showErrorMessage(`GitWizard Error: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Split to Repo Error: ${err.message}`);
          }
          break;
        }

        case 'PUSH_MAIN': {
          try {
            vscode.window.showInformationMessage('GitWizard: Pushing main branch to origin...');
            const res = await this._repoSplitterWizard.pushToOrigin('main');
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Error: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Push Error: ${err.message}`);
          }
          break;
        }

        case 'SAFE_COMMIT': {
          try {
            if (data.authorName && data.authorEmail) {
              await this._git.setLocalAuthorIdentity(data.authorName, data.authorEmail);
            }

            const res = await this._essentialsWizard.safeCommit(data.message, {
              allowProtected: data.allowProtected,
              ignoreSecrets: data.ignoreSecrets,
              authorName: data.authorName,
              authorEmail: data.authorEmail
            });

            if (res.needsInit) {
              vscode.window.showInformationMessage('GitWizard: Please enable Safe Mode before saving changes.');
              await this.broadcastStatus();
              break;
            } else if (res.requiresIdentity) {
              this._view?.webview.postMessage({
                type: 'REQUIRE_GIT_IDENTITY',
                message: res.message,
                pendingCommitMessage: data.message
              });
              break;
            }

            if (res.isProtectedBranch) {
              this._view?.webview.postMessage({
                type: 'BRANCH_GUARD_TRIGGERED',
                suggestedFeatureBranch: res.suggestedFeatureBranch,
                message: res.message
              });
            } else if (res.hasSecrets) {
              this._view?.webview.postMessage({
                type: 'SECRET_RADAR_TRIGGERED',
                secrets: res.secrets,
                message: res.message
              });
            } else if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
              await this.broadcastStatus();
            } else {
              vscode.window.showWarningMessage(`GitWizard: ${res.message}`);
              await this.broadcastStatus();
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Save Error: ${err.message}`);
          }
          break;
        }

        case 'REMEDIATE_SECRETS': {
          try {
            const res = this._secretRemediation.remediateSecrets(data.secrets);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: Extracted ${res.remediated.length} secret(s) to .env & updated .gitignore! 🔒`);
              this._view?.webview.postMessage({ type: 'SECRETS_REMEDIATED', success: true });
            } else {
              vscode.window.showErrorMessage(`GitWizard Remediation Error: ${res.error}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Remediation Error: ${err.message}`);
          }
          break;
        }

        case 'RELOCATE_BRANCH': {
          try {
            const res = await this._branchGuard.relocateToFeatureBranch(data.newBranch);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
              this._view?.webview.postMessage({ type: 'BRANCH_RELOCATED', success: true, branch: res.newBranch });
            } else {
              vscode.window.showErrorMessage(`GitWizard Relocation Error: ${res.error || res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Relocation Error: ${err.message}`);
          }
          break;
        }

        case 'SAFE_PUSH': {
          try {
            vscode.window.showInformationMessage('GitWizard: Pushing to remote...');
            const res = await this._essentialsWizard.safePush(data.remote || 'origin');
            if (res.requiresRemote) {
              this._view?.webview.postMessage({
                type: 'REQUIRE_REMOTE_URL',
                message: res.message
              });
              break;
            }
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Push Error: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Push Error: ${err.message}`);
          }
          break;
        }

        case 'SAFE_PULL': {
          try {
            vscode.window.showInformationMessage('GitWizard: Fetching latest updates...');
            const res = await this._essentialsWizard.safePull(data.remote || 'origin');
            if (res.requiresRemote) {
              this._view?.webview.postMessage({
                type: 'REQUIRE_REMOTE_URL',
                message: res.message
              });
              break;
            }
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showWarningMessage(`GitWizard: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Pull Error: ${err.message}`);
          }
          break;
        }

        case 'SET_REMOTE_URL': {
          try {
            const res = await this._essentialsWizard.setRemoteUrl(data.url, data.remote || 'origin');
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
              this._view?.webview.postMessage({
                type: 'REMOTE_URL_CONFIGURED',
                success: true
              });
              if (data.autoPush) {
                vscode.window.showInformationMessage('GitWizard: Connecting & backing up to GitHub...');
                const pushRes = await this._essentialsWizard.safePush(data.remote || 'origin');
                if (pushRes.success) {
                  vscode.window.showInformationMessage(`GitWizard: Cloud backup complete! ☁️`);
                } else {
                  vscode.window.showErrorMessage(`GitWizard Push Error: ${pushRes.message}`);
                }
              }
            } else {
              vscode.window.showErrorMessage(`GitWizard Remote Error: ${res.message}`);
              this._view?.webview.postMessage({
                type: 'REMOTE_URL_CONFIGURED',
                success: false,
                error: res.message
              });
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Remote Error: ${err.message}`);
          }
          break;
        }

        case 'SAFE_UNCOMMIT': {
          try {
            const res = await this._essentialsWizard.safeUncommit();
            vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Uncommit Error: ${err.message}`);
          }
          break;
        }

        case 'CREATE_BRANCH': {
          try {
            const res = await this._essentialsWizard.createBranch(data.branchName);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Branch Error: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Branch Error: ${err.message}`);
          }
          break;
        }

        case 'SWITCH_BRANCH': {
          try {
            const res = await this._essentialsWizard.switchBranch(data.branchName);
            if (res.success) {
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
            } else {
              vscode.window.showErrorMessage(`GitWizard Switch Error: ${res.message}`);
            }
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Switch Error: ${err.message}`);
          }
          break;
        }

        case 'TRIGGER_AUTO_CHECKPOINT': {
          try {
            await this._autoCheckpoint.captureIfDirty(data.label || 'manual-save');
            await this.broadcastStatus();
          } catch (err: any) {
            console.error('Auto checkpoint error:', err);
          }
          break;
        }

        case 'GET_AI_CONFIG': {
          try {
            const config = vscode.workspace.getConfiguration('gitwizard');
            const provider = config.get<string>('aiProvider') || 'gemini';
            const geminiApiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY || '';
            const openaiApiKey = config.get<string>('openaiApiKey') || process.env.OPENAI_API_KEY || '';
            const ollamaBaseUrl = config.get<string>('ollamaBaseUrl') || 'http://localhost:11434';
            const ollamaModel = config.get<string>('ollamaModel') || 'llama3.2';

            this._view?.webview.postMessage({
              type: 'AI_CONFIG_UPDATE',
              config: {
                provider,
                hasGeminiKey: Boolean(geminiApiKey),
                maskedGeminiKey: geminiApiKey ? '••••••••' + geminiApiKey.slice(-4) : '',
                hasOpenAiKey: Boolean(openaiApiKey),
                maskedOpenAiKey: openaiApiKey ? '••••••••' + openaiApiKey.slice(-4) : '',
                ollamaBaseUrl,
                ollamaModel
              }
            });
          } catch (err: any) {
            console.error('Failed to get AI config:', err);
          }
          break;
        }

        case 'SAVE_AI_CONFIG': {
          try {
            const config = vscode.workspace.getConfiguration('gitwizard');
            if (data.provider !== undefined) {
              await config.update('aiProvider', data.provider, vscode.ConfigurationTarget.Global);
            }
            if (data.geminiApiKey !== undefined && !data.geminiApiKey.startsWith('••••••••')) {
              await config.update('geminiApiKey', data.geminiApiKey.trim(), vscode.ConfigurationTarget.Global);
            }
            if (data.openaiApiKey !== undefined && !data.openaiApiKey.startsWith('••••••••')) {
              await config.update('openaiApiKey', data.openaiApiKey.trim(), vscode.ConfigurationTarget.Global);
            }
            if (data.ollamaBaseUrl !== undefined) {
              await config.update('ollamaBaseUrl', data.ollamaBaseUrl.trim(), vscode.ConfigurationTarget.Global);
            }
            if (data.ollamaModel !== undefined) {
              await config.update('ollamaModel', data.ollamaModel.trim(), vscode.ConfigurationTarget.Global);
            }

            this._aiService.updateConfig(getActiveAIConfig());
            vscode.window.showInformationMessage('GitWizard: AI settings saved!');

            this._view?.webview.postMessage({
              type: 'AI_CONFIG_SAVED',
              success: true
            });

            const updatedConfig = vscode.workspace.getConfiguration('gitwizard');
            const p = updatedConfig.get<string>('aiProvider') || 'gemini';
            const gKey = updatedConfig.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY || '';
            const oKey = updatedConfig.get<string>('openaiApiKey') || process.env.OPENAI_API_KEY || '';
            this._view?.webview.postMessage({
              type: 'AI_CONFIG_UPDATE',
              config: {
                provider: p,
                hasGeminiKey: Boolean(gKey),
                maskedGeminiKey: gKey ? '••••••••' + gKey.slice(-4) : '',
                hasOpenAiKey: Boolean(oKey),
                maskedOpenAiKey: oKey ? '••••••••' + oKey.slice(-4) : '',
                ollamaBaseUrl: updatedConfig.get<string>('ollamaBaseUrl') || 'http://localhost:11434',
                ollamaModel: updatedConfig.get<string>('ollamaModel') || 'llama3.2'
              }
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Settings Error: ${err.message}`);
            this._view?.webview.postMessage({
              type: 'AI_CONFIG_SAVED',
              success: false,
              error: err.message
            });
          }
          break;
        }

        case 'TEST_AI_CONNECTION': {
          try {
            const testResult = await this._aiService.testConnection(data.options);
            this._view?.webview.postMessage({
              type: 'AI_CONNECTION_TEST_RESULT',
              ...testResult
            });
          } catch (err: any) {
            this._view?.webview.postMessage({
              type: 'AI_CONNECTION_TEST_RESULT',
              success: false,
              message: `Connection test error: ${err.message}`
            });
          }
          break;
        }

        case 'PREVIEW_SNAPSHOT_DIFF': {
          try {
            const diffFiles = await this._checkpointWizard.getDiffWithCurrent(data.snapshotId);
            this._view?.webview.postMessage({
              type: 'SNAPSHOT_DIFF_PREVIEW',
              snapshotId: data.snapshotId,
              files: diffFiles
            });
          } catch (err: any) {
            console.error('Failed to get checkpoint diff:', err);
            this._view?.webview.postMessage({
              type: 'SNAPSHOT_DIFF_PREVIEW',
              snapshotId: data.snapshotId,
              files: []
            });
          }
          break;
        }

        case 'OPEN_SNAPSHOT_DIFF': {
          try {
            const { snapshotId, snapshotLabel, filePath } = data;
            if (!snapshotId || !filePath) break;
            const normalizedPath = filePath.replace(/\\/g, '/');
            const leftUri = vscode.Uri.parse(`gitwizard-snapshot://${snapshotId}/${normalizedPath}`);
            const rightUri = vscode.Uri.file(path.join(this._git.repoPath, filePath));
            const title = `${path.basename(filePath)} (${snapshotLabel || 'Snapshot'}) ↔ (Current Workspace)`;
            await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Error: Could not open diff: ${err.message}`);
          }
          break;
        }

        case 'GENERATE_PR_SUMMARY': {
          try {
            this._aiService.updateConfig(getActiveAIConfig());
            const prDesc = await this._aiCommitWizard.generatePRDescription(data.baseBranch || 'main');
            this._view?.webview.postMessage({
              type: 'PR_SUMMARY_GENERATED',
              title: prDesc.title,
              body: prDesc.body,
              error: prDesc.error
            });
          } catch (err: any) {
            this._view?.webview.postMessage({
              type: 'PR_SUMMARY_GENERATED',
              error: err.message
            });
          }
          break;
        }

        case 'CREATE_PULL_REQUEST': {
          try {
            vscode.window.showInformationMessage('GitWizard: Preparing Pull Request on GitHub...');
            this._aiService.updateConfig(getActiveAIConfig());
            const res = await this._prWizard.createPullRequest({
              baseBranch: data.baseBranch || 'main',
              headBranch: data.headBranch,
              title: data.title,
              body: data.body,
              generateWithAI: true
            });

            if (res.success && res.prUrl) {
              await vscode.env.openExternal(vscode.Uri.parse(res.prUrl));
              vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
              this._view?.webview.postMessage({
                type: 'PR_CREATED',
                result: res
              });
            } else {
              vscode.window.showErrorMessage(`GitWizard PR Error: ${res.error || res.message}`);
              this._view?.webview.postMessage({
                type: 'PR_ERROR',
                error: res.error || res.message
              });
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard PR Error: ${err.message}`);
            this._view?.webview.postMessage({
              type: 'PR_ERROR',
              error: err.message
            });
          }
          break;
        }
      }
    });
  }

  public openSettings(reason?: string) {
    this._view?.webview.postMessage({ type: 'OPEN_SETTINGS', reason });
  }

  public async broadcastStatus() {
    try {
      const status = await this._git.getStatus();
      const proStatus = this._licenseManager.getStatus();

      if (!status.isRepo) {
        this._view?.webview.postMessage({
          type: 'STATUS_UPDATE',
          status,
          snapshots: [],
          actions: [],
          localBranches: [],
          proStatus
        });
        await this._updateStatusBar();
        return;
      }

      const snapshots = await this._checkpointWizard.listCheckpoints();
      const actions = await this._undoWizard.getRecentActions(10);
      const branchesRes = await this._git.exec(['branch', '--format=%(refname:short)'], { allowFailure: true });
      const localBranches = branchesRes.exitCode === 0 && branchesRes.stdout ? branchesRes.stdout.split('\n').filter(Boolean) : [];

      this._view?.webview.postMessage({
        type: 'STATUS_UPDATE',
        status,
        snapshots,
        actions,
        localBranches,
        proStatus
      });
      await this._updateStatusBar();
    } catch (err) {
      console.error('Failed to broadcast status:', err);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitWizard Pro</title>
  <style>
    body {
      padding: 10px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background-color: var(--vscode-sideBar-background);
      box-sizing: border-box;
      margin: 0;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const rootPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : process.cwd();

  const git = new GitClient(rootPath);
  const snapshotManager = new SnapshotManager(git);
  const runner = new TransactionRunner(git, snapshotManager);

  // Pro Engines & Radar
  const secretScanner = new SecretScanner();
  const branchGuard = new ProductionBranchGuard(git, snapshotManager);
  const secretRemediation = new SecretRemediationEngine(rootPath);
  const fileRewind = new FileRewindEngine(git, snapshotManager);

  const checkpointWizard = new CheckpointWizard(git, snapshotManager);
  const splitterWizard = new BranchSplitterWizard(git, snapshotManager, runner);
  const syncWizard = new SafeSyncWizard(git, snapshotManager);
  const undoWizard = new UndoWizard(git, snapshotManager);
  const repoSplitterWizard = new RepoSplitterWizard(git, snapshotManager, runner);
  const essentialsWizard = new DailyEssentialsWizard(git, snapshotManager, branchGuard, secretScanner);
  const autoCheckpoint = new AutoCheckpointController(git, snapshotManager);

  // Pro Engines
  const licenseStorage = new VSCodeLicenseStorage(context.globalState);
  const licenseManager = new LicenseManager(licenseStorage);
  const aiService = new AIService(getActiveAIConfig());
  const aiCommitWizard = new AICommitWizard(git, aiService, licenseManager);
  const aiSplitter = new AISplitterEngine(git, aiService, licenseManager, splitterWizard);
  const conflictResolver = new ConflictResolverEngine(git, snapshotManager, licenseManager, aiService);
  const cloudSync = new CloudSyncEngine(git, snapshotManager, licenseManager);
  const prWizard = new PullRequestWizard(git, aiCommitWizard, licenseManager);

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'gitwizard.focusSidebar';
  statusBarItem.tooltip = 'GitWizard: Safe Git for Vibe Coders (Click to Open)';
  statusBarItem.text = '$(wand) GitWizard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = async () => {
    try {
      const status = await git.getStatus();
      if (!status.isRepo) {
        statusBarItem.text = '$(wand) Safe Mode (Off)';
        statusBarItem.tooltip = 'GitWizard: Safe Mode is not active. Click to initialize.';
        statusBarItem.backgroundColor = undefined;
        return;
      }
      const dirtyCount = status.modified.length + status.staged.length + status.untracked.length;
      const pro = licenseManager.getStatus();
      const proTag = pro.isPro ? ' ⭐' : '';
      if (dirtyCount === 0) {
        statusBarItem.text = `$(wand) ${status.branch}${proTag} (clean)`;
        statusBarItem.backgroundColor = undefined;
      } else {
        statusBarItem.text = `$(wand) ${status.branch}${proTag} (${dirtyCount} dirty)`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      }
    } catch {
      statusBarItem.text = '$(wand) GitWizard';
    }
  };

  const provider = new GitWizardSidebarProvider(
    context.extensionUri,
    git,
    snapshotManager,
    checkpointWizard,
    splitterWizard,
    syncWizard,
    undoWizard,
    repoSplitterWizard,
    essentialsWizard,
    autoCheckpoint,
    licenseManager,
    aiService,
    aiCommitWizard,
    branchGuard,
    secretScanner,
    secretRemediation,
    fileRewind,
    aiSplitter,
    conflictResolver,
    cloudSync,
    prWizard,
    updateStatusBar
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GitWizardSidebarProvider.viewType, provider)
  );

  // Register Virtual Snapshot Document Provider for side-by-side diffs
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('gitwizard-snapshot', new SnapshotContentProvider(snapshotManager))
  );

  // Register Diff Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.openSnapshotDiff', async (snapshotId: string, filePath: string, label?: string) => {
      if (!snapshotId || !filePath) return;
      const leftUri = vscode.Uri.parse(`gitwizard-snapshot://${snapshotId}/${filePath.replace(/\\/g, '/')}`);
      const rightUri = vscode.Uri.file(path.join(rootPath, filePath));
      const title = `${path.basename(filePath)} (${label || 'Snapshot'}) ↔ (Current)`;
      await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
    })
  );

  // Register 1-Click Pull Request Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.createPullRequest', async () => {
      try {
        vscode.window.showInformationMessage('GitWizard: Analyzing branch and creating PR on GitHub...');
        aiService.updateConfig(getActiveAIConfig());
        const res = await prWizard.createPullRequest({ generateWithAI: true });
        if (res.success && res.prUrl) {
          await vscode.env.openExternal(vscode.Uri.parse(res.prUrl));
          vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
        } else {
          vscode.window.showErrorMessage(`GitWizard: ${res.error || res.message}`);
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`GitWizard PR Error: ${err.message}`);
      }
    })
  );

  // Passive Auto-Checkpoint File Watcher: captures shadow snapshots on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async () => {
      await autoCheckpoint.scheduleAutoCheckpoint('pre-prompt-save', 2500);
      await provider.broadcastStatus();
    })
  );

  // Focus Sidebar Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.focusSidebar', async () => {
      await vscode.commands.executeCommand('gitwizard.sidebarView.focus');
    })
  );

  // Enable Safe Mode (git init) Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.initRepo', async () => {
      vscode.window.showInformationMessage('GitWizard: Enabling Safe Mode...');
      const initRes = await git.initRepo();
      if (initRes.exitCode === 0) {
        try {
          await checkpointWizard.saveCheckpoint('Initial Safe Mode Baseline');
        } catch {}
        vscode.window.showInformationMessage('GitWizard: Safe Mode Enabled! 🧙‍♂️');
      } else {
        vscode.window.showErrorMessage('GitWizard Init Failed: ' + initRes.stderr);
      }
      await provider.broadcastStatus();
    })
  );

  // Pro: Generate AI Commit Message Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.generateAICommit', async () => {
      aiService.updateConfig(getActiveAIConfig());
      const res = await aiCommitWizard.generateCommitMessage();
      if (res.success && res.commitMessage) {
        const action = await vscode.window.showInformationMessage(
          `AI Commit: "${res.commitMessage}"`,
          'Commit Now',
          'Copy Message'
        );
        if (action === 'Commit Now') {
          await essentialsWizard.safeCommit(res.commitMessage);
          provider.broadcastStatus();
        } else if (action === 'Copy Message') {
          await vscode.env.clipboard.writeText(res.commitMessage);
          vscode.window.showInformationMessage('GitWizard: Commit message copied to clipboard!');
        }
      } else if (res.requiresPro) {
        const activate = await vscode.window.showWarningMessage(
          res.error || 'GitWizard Pro required.',
          'Activate License'
        );
        if (activate === 'Activate License') {
          await vscode.commands.executeCommand('gitwizard.activateLicense');
        }
      } else {
        vscode.window.showErrorMessage(`GitWizard AI Error: ${res.error}`);
      }
    })
  );

  // Pro: Activate License Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.activateLicense', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your GitWizard Pro Lifetime License Key:',
        placeHolder: 'GWPRO-LIFETIME.<email>.<time>.<sig>'
      });
      if (key) {
        const res = licenseManager.activateLicense(key);
        if (res.isPro) {
          vscode.window.showInformationMessage(`GitWizard Pro: Activated for ${res.email}! Thank you! 🎉`);
          provider.broadcastStatus();
        } else {
          vscode.window.showErrorMessage(`GitWizard Pro: ${res.reason || 'Invalid license key'}`);
        }
      }
    })
  );

  // Pro: Configure AI Provider & API Key Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.configureAI', async () => {
      try {
        await vscode.commands.executeCommand('gitwizard.sidebarView.focus');
        provider.openSettings();
      } catch {
        const providerPick = await vscode.window.showQuickPick(
          [
            { label: 'Google Gemini', description: 'Fast, high-quality, free-tier available', value: 'gemini' },
            { label: 'OpenAI (gpt-4o-mini)', description: 'Industry standard reasoning', value: 'openai' },
            { label: 'Local Ollama', description: '100% offline, zero API keys required', value: 'ollama' }
          ],
          { placeHolder: 'Select your preferred AI provider for GitWizard Pro:' }
        );
        if (!providerPick) return;

        const config = vscode.workspace.getConfiguration('gitwizard');
        await config.update('aiProvider', providerPick.value, vscode.ConfigurationTarget.Global);

        if (providerPick.value !== 'ollama') {
          const key = await vscode.window.showInputBox({
            prompt: `Enter API key for ${providerPick.label}:`,
            password: true
          });
          if (key) {
            const setting = providerPick.value === 'gemini' ? 'geminiApiKey' : 'openaiApiKey';
            await config.update(setting, key, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`GitWizard: Configured ${providerPick.label} successfully!`);
          }
        } else {
          vscode.window.showInformationMessage(`GitWizard: Local Ollama configured at http://localhost:11434.`);
        }
      }
    })
  );

  // Checkpoint Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.createCheckpoint', async () => {
      const label = await vscode.window.showInputBox({ prompt: 'Enter a label for this checkpoint:' });
      if (label !== undefined) {
        const snap = await checkpointWizard.saveCheckpoint(label || 'checkpoint');
        vscode.window.showInformationMessage(`GitWizard: Checkpoint '${snap.label}' captured!`);
        provider.broadcastStatus();
      }
    })
  );

  // Restore Checkpoint Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.restoreCheckpoint', async () => {
      const snaps = await checkpointWizard.listCheckpoints();
      if (snaps.length === 0) {
        vscode.window.showInformationMessage('No GitWizard checkpoints found.');
        return;
      }
      const items = snaps.map(s => ({
        label: s.label,
        description: new Date(s.timestamp).toLocaleTimeString(),
        id: s.id
      }));
      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select checkpoint to restore:' });
      if (selected) {
        await checkpointWizard.restoreCheckpoint(selected.id);
        vscode.window.showInformationMessage(`GitWizard: Restored to checkpoint '${selected.label}'`);
        provider.broadcastStatus();
      }
    })
  );

  // Safe Sync Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.safeSync', async () => {
      const res = await syncWizard.safeSync();
      if (res.success) {
        vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
      } else {
        vscode.window.showWarningMessage(`GitWizard: ${res.message}`);
      }
      provider.broadcastStatus();
    })
  );

  // Split to New Repo Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.splitToNewRepo', async () => {
      const branch = await vscode.window.showInputBox({
        prompt: 'Enter branch to promote to new repo:',
        value: 'template/antigravity-starter'
      });
      if (!branch) return;

      const repoName = await vscode.window.showInputBox({
        prompt: 'Enter name for the new GitHub repo:',
        value: 'antigravity-starter'
      });
      if (!repoName) return;

      const res = await repoSplitterWizard.splitToNewRepo({
        sourceBranch: branch,
        newRepoName: repoName,
        targetBranch: 'main'
      });

      if (res.success) {
        vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
      } else {
        vscode.window.showErrorMessage(`GitWizard Error: ${res.message}`);
      }
      provider.broadcastStatus();
    })
  );

  // Push Main Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.pushMain', async () => {
      const res = await repoSplitterWizard.pushToOrigin('main');
      if (res.success) {
        vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
      } else {
        vscode.window.showErrorMessage(`GitWizard Error: ${res.message}`);
      }
      provider.broadcastStatus();
    })
  );

  // Undo Last Action Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.undoLast', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'GitWizard: Rewind last Git action to HEAD@{1}?',
        { modal: true },
        'Undo Action'
      );
      if (confirm === 'Undo Action') {
        try {
          const res = await undoWizard.undoLastAction();
          vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
          provider.broadcastStatus();
        } catch (err: any) {
          vscode.window.showErrorMessage(`GitWizard Undo Error: ${err.message}`);
        }
      }
    })
  );

  // Pro: Rewind Single File Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.rewindFile', async () => {
      const snaps = await snapshotManager.listSnapshots();
      if (snaps.length === 0) {
        vscode.window.showInformationMessage('No GitWizard snapshots available.');
        return;
      }
      const snapPick = await vscode.window.showQuickPick(
        snaps.map(s => ({
          label: s.label,
          description: new Date(s.timestamp).toLocaleTimeString(),
          id: s.id
        })),
        { placeHolder: 'Select snapshot to rewind a file from:' }
      );
      if (!snapPick) return;

      const filePath = await vscode.window.showInputBox({
        prompt: 'Enter relative path of file to rewind (e.g. src/utils/helpers.ts):'
      });
      if (!filePath) return;

      const res = await fileRewind.rewindFile(snapPick.id, filePath.trim());
      if (res.success) {
        vscode.window.showInformationMessage(`GitWizard: ${res.message}`);
        provider.broadcastStatus();
      } else {
        vscode.window.showErrorMessage(`GitWizard: ${res.error || res.message}`);
      }
    })
  );

  // Pro: Auto-Split with AI Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.autoSplit', async () => {
      aiService.updateConfig(getActiveAIConfig());
      const plan = await aiSplitter.planAutoSplit();
      if (!plan.success) {
        if (plan.requiresPro) {
          const activate = await vscode.window.showWarningMessage(plan.error || 'Pro license required', 'Activate License');
          if (activate === 'Activate License') {
            await vscode.commands.executeCommand('gitwizard.activateLicense');
          }
        } else {
          vscode.window.showErrorMessage(`GitWizard Auto-Split: ${plan.error}`);
        }
        return;
      }
      const confirm = await vscode.window.showInformationMessage(
        `AI Auto-Split created ${plan.groups.length} branches across ${plan.totalFiles} files. Execute?`,
        'Execute Split',
        'Cancel'
      );
      if (confirm === 'Execute Split') {
        const res = await aiSplitter.executeAutoSplit(plan.groups);
        if (res.success) {
          vscode.window.showInformationMessage(`GitWizard: Auto-split completed into: ${res.createdBranches.join(', ')}`);
          provider.broadcastStatus();
        } else {
          vscode.window.showErrorMessage(`GitWizard Auto-Split: ${res.error}`);
        }
      }
    })
  );

  // Pro: AI Merge Conflict Resolver Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.resolveConflicts', async () => {
      const analysis = await conflictResolver.analyzeConflicts();
      if (!analysis.hasConflicts || analysis.files.length === 0) {
        vscode.window.showInformationMessage('GitWizard: No active merge conflicts detected in your repository.');
        return;
      }
      const filePick = await vscode.window.showQuickPick(
        analysis.files.map(f => ({
          label: f.filePath,
          description: `${f.conflictBlocksCount} conflict blocks`,
          file: f
        })),
        { placeHolder: 'Select conflicted file to resolve with AI:' }
      );
      if (!filePick) return;

      vscode.window.showInformationMessage(`GitWizard: Synthesizing AI resolution for ${filePick.label}...`);
      try {
        aiService.updateConfig(getActiveAIConfig());
        const resolution = await conflictResolver.resolveConflictForFile(filePick.label);
        const confirm = await vscode.window.showInformationMessage(
          `AI Resolution ready: ${resolution.rationale}. Apply and stage?`,
          'Apply Resolution',
          'Cancel'
        );
        if (confirm === 'Apply Resolution') {
          await conflictResolver.applyResolutions([resolution]);
          vscode.window.showInformationMessage(`GitWizard: Resolved and staged ${filePick.label}! 🛡️`);
          provider.broadcastStatus();
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`GitWizard Conflict Error: ${err.message}`);
      }
    })
  );

  // Pro: Push Encrypted Snapshots to Remote Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.cloudPush', async () => {
      vscode.window.showInformationMessage('GitWizard: Encrypting and pushing snapshots to remote...');
      const res = await cloudSync.pushToCloud();
      if (res.success) {
        vscode.window.showInformationMessage(res.message);
      } else {
        vscode.window.showErrorMessage(`GitWizard Cloud Sync: ${res.message}`);
      }
    })
  );

  // Pro: Pull Encrypted Snapshots from Remote Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.cloudPull', async () => {
      vscode.window.showInformationMessage('GitWizard: Pulling and decrypting snapshots from remote...');
      const res = await cloudSync.pullFromCloud();
      if (res.success) {
        vscode.window.showInformationMessage(res.message);
        provider.broadcastStatus();
      } else {
        vscode.window.showErrorMessage(`GitWizard Cloud Sync: ${res.message}`);
      }
    })
  );

  updateStatusBar();
}

export function deactivate() {}
