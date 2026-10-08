import React, { useState, useEffect } from 'react';

declare function acquireVsCodeApi(): {
  postMessage(msg: any): void;
  getState(): any;
  setState(state: any): void;
};

let vscode: any = null;
try {
  vscode = acquireVsCodeApi();
} catch {
  vscode = {
    postMessage: (m: any) => console.log('Mock postMessage:', m)
  };
}

export interface GitRepoStatus {
  branch: string;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  inMerge: boolean;
  inRebase: boolean;
}

export interface SnapshotMetadata {
  id: string;
  label: string;
  timestamp: number;
  branch: string;
}

export interface HumanGitAction {
  hash: string;
  selector: string;
  category: 'commit' | 'merge' | 'checkout' | 'rebase' | 'reset' | 'other';
  title: string;
  timestamp: string;
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [actions, setActions] = useState<HumanGitAction[]>([]);
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'checkpoint' | 'split' | 'sync' | 'timeline' | 'promote'>('checkpoint');

  // Checkpoint state
  const [checkpointLabel, setCheckpointLabel] = useState('');

  // Splitter state
  const [branchA, setBranchA] = useState('feature/part-1');
  const [commitA, setCommitA] = useState('feat: initial slice');
  const [selectedForA, setSelectedForA] = useState<Record<string, boolean>>({});
  const [branchB, setBranchB] = useState('feature/part-2');
  const [commitB, setCommitB] = useState('feat: second slice');

  // Sync state
  const [syncStrategy, setSyncStrategy] = useState<'rebase' | 'merge'>('rebase');

  // Promote state (Split branch to new repo)
  const [promoteSourceBranch, setPromoteSourceBranch] = useState('template/antigravity-starter');
  const [promoteRepoName, setPromoteRepoName] = useState('antigravity-starter');
  const [promoteVisibility, setPromoteVisibility] = useState<'public' | 'private'>('public');

  useEffect(() => {
    vscode.postMessage({ type: 'GET_STATUS' });

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === 'STATUS_UPDATE') {
        setStatus(data.status);
        setSnapshots(data.snapshots || []);
        if (data.actions) setActions(data.actions);
        if (data.localBranches) setLocalBranches(data.localBranches);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const allDirtyFiles = status
    ? Array.from(new Set([...status.staged, ...status.modified, ...status.untracked]))
    : [];

  const handleCreateCheckpoint = () => {
    vscode.postMessage({
      type: 'CREATE_CHECKPOINT',
      label: checkpointLabel.trim() || 'vibe-save'
    });
    setCheckpointLabel('');
  };

  const handleRestoreCheckpoint = (snapshotId: string) => {
    vscode.postMessage({
      type: 'RESTORE_CHECKPOINT',
      snapshotId
    });
  };

  const handleRunSplit = () => {
    const filesA = Object.keys(selectedForA).filter((f) => selectedForA[f]);
    const filesB = allDirtyFiles.filter((f) => !selectedForA[f]);

    if (filesA.length === 0) {
      alert('Please select at least one file for Branch A');
      return;
    }
    if (filesB.length === 0) {
      alert('Branch B must also have at least one file.');
      return;
    }

    vscode.postMessage({
      type: 'SPLIT_CHANGES',
      request: {
        groups: [
          { branchName: branchA.trim(), commitMessage: commitA.trim(), files: filesA },
          { branchName: branchB.trim(), commitMessage: commitB.trim(), files: filesB }
        ]
      }
    });
  };

  const handleSafeSync = () => {
    vscode.postMessage({
      type: 'SAFE_SYNC',
      strategy: syncStrategy
    });
  };

  const handleUndoLast = () => {
    vscode.postMessage({ type: 'UNDO_LAST' });
  };

  const handlePromoteToNewRepo = () => {
    vscode.postMessage({
      type: 'SPLIT_TO_NEW_REPO',
      options: {
        sourceBranch: promoteSourceBranch.trim(),
        newRepoName: promoteRepoName.trim(),
        targetBranch: 'main',
        visibility: promoteVisibility,
        description: 'Universal Antigravity & Claude Code bootstrap template'
      }
    });
  };

  const handlePushMain = () => {
    vscode.postMessage({ type: 'PUSH_MAIN' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Top Status Card */}
      <div
        style={{
          background: 'var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.06))',
          padding: '10px 12px',
          borderRadius: '6px',
          border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            🌿 Branch: <span style={{ color: 'var(--vscode-textLink-foreground)' }}>{status?.branch || 'loading...'}</span>
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: allDirtyFiles.length > 0 ? 'var(--vscode-inputValidation-warningBackground, #855a00)' : 'var(--vscode-testing-iconPassed, #388a34)',
              color: '#fff'
            }}
          >
            {allDirtyFiles.length > 0 ? `${allDirtyFiles.length} dirty` : 'Clean'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
        {[
          { id: 'checkpoint', label: '🛡️ Save' },
          { id: 'split', label: '✂️ Split' },
          { id: 'sync', label: '🔄 Sync' },
          { id: 'timeline', label: '⏪ Undo' },
          { id: 'promote', label: '🚀 Repo' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '7px 2px',
              background: activeTab === t.id ? 'var(--vscode-button-background)' : 'transparent',
              color: activeTab === t.id ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
              border: '1px solid var(--vscode-button-border, rgba(255,255,255,0.15))',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              textAlign: 'center'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Checkpoint */}
      {activeTab === 'checkpoint' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
            Capture working tree before asking AI to refactor. Zero commit clutter; 1-click restore.
          </p>
          <input
            type="text"
            placeholder="Label (e.g., before UI rewrite)"
            value={checkpointLabel}
            onChange={(e) => setCheckpointLabel(e.target.value)}
            style={{
              padding: '7px 10px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <button
            onClick={handleCreateCheckpoint}
            style={{
              padding: '8px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            📸 Save Checkpoint
          </button>
        </div>
      )}

      {/* TAB 2: Branch Splitter */}
      {activeTab === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
            Divide your modified files into two clean branches automatically.
          </p>

          {allDirtyFiles.length < 2 ? (
            <div style={{ fontSize: '12px', opacity: 0.7, padding: '8px' }}>
              Requires at least 2 modified or new files to split. Currently {allDirtyFiles.length} file(s) dirty.
            </div>
          ) : (
            <>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Branch A (Checked Files):</div>
                <input
                  type="text"
                  value={branchA}
                  onChange={(e) => setBranchA(e.target.value)}
                  placeholder="Branch A name"
                  style={{ width: '100%', marginBottom: '4px', padding: '4px', fontSize: '11px' }}
                />
                <input
                  type="text"
                  value={commitA}
                  onChange={(e) => setCommitA(e.target.value)}
                  placeholder="Commit message A"
                  style={{ width: '100%', padding: '4px', fontSize: '11px' }}
                />
              </div>

              <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Select files for Branch A:</div>
                {allDirtyFiles.map((file) => (
                  <label key={file} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', padding: '2px 0' }}>
                    <input
                      type="checkbox"
                      checked={!!selectedForA[file]}
                      onChange={(e) => setSelectedForA({ ...selectedForA, [file]: e.target.checked })}
                    />
                    <span>{file}</span>
                  </label>
                ))}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Branch B (Remaining Files):</div>
                <input
                  type="text"
                  value={branchB}
                  onChange={(e) => setBranchB(e.target.value)}
                  placeholder="Branch B name"
                  style={{ width: '100%', marginBottom: '4px', padding: '4px', fontSize: '11px' }}
                />
                <input
                  type="text"
                  value={commitB}
                  onChange={(e) => setCommitB(e.target.value)}
                  placeholder="Commit message B"
                  style={{ width: '100%', padding: '4px', fontSize: '11px' }}
                />
              </div>

              <button
                onClick={handleRunSplit}
                style={{
                  padding: '8px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px'
                }}
              >
                ✂️ Execute Safe Split
              </button>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Safe Sync */}
      {activeTab === 'sync' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
            Fetch and pull changes from remote safely. Automatically aborts and restores your workspace if conflicts occur.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="strategy"
                checked={syncStrategy === 'rebase'}
                onChange={() => setSyncStrategy('rebase')}
              />
              Rebase
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="strategy"
                checked={syncStrategy === 'merge'}
                onChange={() => setSyncStrategy('merge')}
              />
              Merge
            </label>
          </div>
          <button
            onClick={handleSafeSync}
            style={{
              padding: '8px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            🔄 Sync with Remote
          </button>
        </div>
      )}

      {/* TAB 4: Time Machine / Undo */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleUndoLast}
            style={{
              padding: '7px',
              background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
              color: 'var(--vscode-button-secondaryForeground, #ffffff)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            ⏪ Undo Last Action (HEAD@&#123;1&#125;)
          </button>

          <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8 }}>Saved Checkpoints:</div>
          {snapshots.length === 0 ? (
            <div style={{ fontSize: '11px', opacity: 0.6 }}>No checkpoints saved yet.</div>
          ) : (
            snapshots.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '4px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '11px' }}>{s.label}</div>
                  <div style={{ fontSize: '10px', opacity: 0.5 }}>{new Date(s.timestamp).toLocaleTimeString()}</div>
                </div>
                <button
                  onClick={() => handleRestoreCheckpoint(s.id)}
                  style={{
                    padding: '3px 6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    border: 'none'
                  }}
                >
                  Restore
                </button>
              </div>
            ))
          )}

          {actions.length > 0 && (
            <>
              <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8, marginTop: '4px' }}>Recent Git Activity:</div>
              <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {actions.map((act, i) => (
                  <div key={i} style={{ fontSize: '10px', opacity: 0.75, padding: '3px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontWeight: 600 }}>{act.selector}:</span> {act.title}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: Promote / Split to New Repo */}
      {activeTab === 'promote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
            Promote an experimental branch into its own brand new GitHub repository as <code>main</code>.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>Source Branch:</div>
            <input
              type="text"
              value={promoteSourceBranch}
              onChange={(e) => setPromoteSourceBranch(e.target.value)}
              placeholder="e.g. template/antigravity-starter"
              style={{ padding: '5px', fontSize: '11px' }}
            />

            <div style={{ fontSize: '11px', fontWeight: 600 }}>New GitHub Repo Name:</div>
            <input
              type="text"
              value={promoteRepoName}
              onChange={(e) => setPromoteRepoName(e.target.value)}
              placeholder="e.g. antigravity-starter"
              style={{ padding: '5px', fontSize: '11px' }}
            />

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="visibility"
                  checked={promoteVisibility === 'public'}
                  onChange={() => setPromoteVisibility('public')}
                />
                Public
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="visibility"
                  checked={promoteVisibility === 'private'}
                  onChange={() => setPromoteVisibility('private')}
                />
                Private
              </label>
            </div>
          </div>

          <button
            onClick={handlePromoteToNewRepo}
            style={{
              padding: '9px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px'
            }}
          >
            🚀 Create & Publish Standalone Repo
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />

          <button
            onClick={handlePushMain}
            style={{
              padding: '7px',
              background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
              color: 'var(--vscode-button-secondaryForeground, #ffffff)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            ⬆️ Push GitWizard (main) to Origin
          </button>
        </div>
      )}
    </div>
  );
};
