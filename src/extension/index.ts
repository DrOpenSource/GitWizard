import * as vscode from 'vscode';
import { GitClient } from '../engine/git-client';
import { SnapshotManager } from '../engine/snapshot';
import { TransactionRunner } from '../engine/transaction';

class GitWizardSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitwizard.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _git: GitClient,
    private readonly _snapshotManager: SnapshotManager,
    private readonly _runner: TransactionRunner
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
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
          const status = await this._git.getStatus();
          const snapshots = await this._snapshotManager.listSnapshots();
          this._view?.webview.postMessage({
            type: 'STATUS_UPDATE',
            status,
            snapshots
          });
          break;
        }
        case 'CREATE_CHECKPOINT': {
          try {
            const snap = await this._snapshotManager.createSnapshot(data.label || 'checkpoint');
            vscode.window.showInformationMessage(`GitWizard: Checkpoint '${snap.label}' saved!`);
            const status = await this._git.getStatus();
            const snapshots = await this._snapshotManager.listSnapshots();
            this._view?.webview.postMessage({
              type: 'STATUS_UPDATE',
              status,
              snapshots
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Error: ${err.message}`);
          }
          break;
        }
        case 'RESTORE_CHECKPOINT': {
          try {
            await this._snapshotManager.restoreSnapshot(data.snapshotId);
            vscode.window.showInformationMessage(`GitWizard: Successfully restored checkpoint!`);
            const status = await this._git.getStatus();
            const snapshots = await this._snapshotManager.listSnapshots();
            this._view?.webview.postMessage({
              type: 'STATUS_UPDATE',
              status,
              snapshots
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`GitWizard Restore Error: ${err.message}`);
          }
          break;
        }
      }
    });
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

  const provider = new GitWizardSidebarProvider(
    context.extensionUri,
    git,
    snapshotManager,
    runner
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GitWizardSidebarProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.createCheckpoint', async () => {
      const label = await vscode.window.showInputBox({ prompt: 'Enter a label for this checkpoint:' });
      if (label !== undefined) {
        const snap = await snapshotManager.createSnapshot(label || 'checkpoint');
        vscode.window.showInformationMessage(`GitWizard: Checkpoint '${snap.label}' saved!`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitwizard.restoreCheckpoint', async () => {
      const snaps = await snapshotManager.listSnapshots();
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
        await snapshotManager.restoreSnapshot(selected.id);
        vscode.window.showInformationMessage(`GitWizard: Restored to checkpoint '${selected.label}'`);
      }
    })
  );
}

export function deactivate() {}
