import * as vscode from 'vscode';
import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import { TransactionRunner } from '../engine/transaction';
import { CheckpointWizard } from '../wizards/checkpoint';
import { BranchSplitterWizard, SplitRequest } from '../wizards/split';
import { SafeSyncWizard } from '../wizards/sync';
import { UndoWizard } from '../wizards/undo';

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
    private readonly _undoWizard: UndoWizard
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
      }
    });
  }

  public async broadcastStatus() {
    try {
      const status = await this._git.getStatus();
      const snapshots = await this._checkpointWizard.listCheckpoints();
      const actions = await this._undoWizard.getRecentActions(10);
      this._view?.webview.postMessage({
        type: 'STATUS_UPDATE',
        status,
        snapshots,
        actions
      });
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
  <title>GitWizard</title>
  <style>
    body {
      padding: 10px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background-color: var(--vscode-sideBar-background);
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

  const checkpointWizard = new CheckpointWizard(git, snapshotManager);
  const splitterWizard = new BranchSplitterWizard(git, snapshotManager, runner);
  const syncWizard = new SafeSyncWizard(git, snapshotManager);
  const undoWizard = new UndoWizard(git, snapshotManager);

  const provider = new GitWizardSidebarProvider(
    context.extensionUri,
    git,
    snapshotManager,
    checkpointWizard,
    splitterWizard,
    syncWizard,
    undoWizard
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GitWizardSidebarProvider.viewType, provider)
  );

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
}

export function deactivate() {}
