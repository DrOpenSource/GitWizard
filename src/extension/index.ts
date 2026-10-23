import * as vscode from 'vscode';
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
              const enteredKey = await vscode.window.showInputBox({
                prompt: `Enter your ${configSummary.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API Key:`,
                password: true,
                placeHolder: configSummary.provider === 'gemini' ? 'AIzaSy...' : 'sk-...'
              });
              if (!enteredKey) {
                this._view?.webview.postMessage({
                  type: 'AI_COMMIT_RESPONSE',
                  success: false,
                  error: 'API key is required to generate commit messages with AI.'
                });
                break;
              }
              const settingKey = configSummary.provider === 'gemini' ? 'geminiApiKey' : 'openaiApiKey';
              await vscode.workspace.getConfiguration('gitwizard').update(settingKey, enteredKey, vscode.ConfigurationTarget.Global);
              this._aiService.updateConfig({ apiKey: enteredKey });
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
            await this.broadcastStatus();
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Error: ${err.message}`);
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
            const res = await this._essentialsWizard.safeCommit(data.message, {
              allowProtected: data.allowProtected,
              ignoreSecrets: data.ignoreSecrets
            });

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
      }
    });
  }

  public async broadcastStatus() {
    try {
      const status = await this._git.getStatus();
      const snapshots = await this._checkpointWizard.listCheckpoints();
      const actions = await this._undoWizard.getRecentActions(10);
      const branchesRes = await this._git.exec(['branch', '--format=%(refname:short)'], { allowFailure: true });
      const localBranches = branchesRes.exitCode === 0 && branchesRes.stdout ? branchesRes.stdout.split('\n').filter(Boolean) : [];
      const proStatus = this._licenseManager.getStatus();

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
    updateStatusBar
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GitWizardSidebarProvider.viewType, provider)
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

  // Split Changes Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.splitChanges', async () => {
      await vscode.commands.executeCommand('gitwizard.sidebarView.focus');
      vscode.window.showInformationMessage('GitWizard: Select files in the sidebar Branch Splitter to organize branches.');
    })
  );

  updateStatusBar();
}

export function deactivate() {}
