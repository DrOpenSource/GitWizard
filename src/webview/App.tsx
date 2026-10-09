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

interface ConfirmModalData {
  title: string;
  description: string;
  consequences: string[];
  confirmButtonText: string;
  onConfirm: () => void;
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [actions, setActions] = useState<HumanGitAction[]>([]);
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'timeline' | 'split' | 'promote'>('daily');

  // Everyday state
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // Splitter state
  const [branchA, setBranchA] = useState('feature/frontend');
  const [commitA, setCommitA] = useState('feat: ui improvements');
  const [selectedForA, setSelectedForA] = useState<Record<string, boolean>>({});
  const [branchB, setBranchB] = useState('feature/backend');
  const [commitB, setCommitB] = useState('feat: backend changes');

  // Promote state (Split branch to new repo)
  const [promoteSourceBranch, setPromoteSourceBranch] = useState('template/antigravity-starter');
  const [promoteRepoName, setPromoteRepoName] = useState('my-new-project');
  const [promoteVisibility, setPromoteVisibility] = useState<'public' | 'private'>('public');

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);

  useEffect(() => {
    vscode.postMessage({ type: 'GET_STATUS' });

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === 'STATUS_UPDATE') {
        setStatus(data.status);
        setSnapshots(data.snapshots || []);
        if (data.actions) setActions(data.actions);
        if (data.localBranches) {
          setLocalBranches(data.localBranches);
          if (data.status?.branch && !selectedBranch) {
            setSelectedBranch(data.status.branch);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const allDirtyFiles = status
    ? Array.from(new Set([...status.staged, ...status.modified, ...status.untracked]))
    : [];

  // Plain-English Handlers
  const handleQuickCommit = () => {
    if (!commitMessage.trim()) {
      alert('Please write a short description of what you changed.');
      return;
    }
    vscode.postMessage({
      type: 'SAFE_COMMIT',
      message: commitMessage.trim()
    });
    setCommitMessage('');
  };

  const handleAskSafePush = () => {
    setConfirmModal({
      title: '⬆️ Send to GitHub (Push)',
      description: `You are about to push your committed work on '${status?.branch || 'current branch'}' to your remote repository.`,
      consequences: [
        'Your code will be synchronized to the remote server.',
        'Anyone with access will see your latest commits.'
      ],
      confirmButtonText: 'Yes, Send to GitHub',
      onConfirm: () => {
        vscode.postMessage({ type: 'SAFE_PUSH', remote: 'origin' });
        setConfirmModal(null);
      }
    });
  };

  const handleAskSafePull = () => {
    setConfirmModal({
      title: '⬇️ Get Latest Updates (Safe Pull)',
      description: 'Fetch the newest updates from your remote repository.',
      consequences: [
        'GitWizard takes an automatic shadow backup of your current files first.',
        'If any conflicts occur, it safely rolls back so nothing gets scrambled.'
      ],
      confirmButtonText: 'Yes, Get Latest Safely',
      onConfirm: () => {
        vscode.postMessage({ type: 'SAFE_PULL', remote: 'origin' });
        setConfirmModal(null);
      }
    });
  };

  const handleAskSafeUncommit = () => {
    setConfirmModal({
      title: '↩️ Undo Last Commit (Keep Files)',
      description: 'Need to make changes before committing? This unwinds your last commit.',
      consequences: [
        '100% of your code modifications remain untouched in your editor.',
        'Only the commit container is undone so you can add more edits.'
      ],
      confirmButtonText: 'Yes, Undo Last Commit',
      onConfirm: () => {
        vscode.postMessage({ type: 'SAFE_UNCOMMIT' });
        setConfirmModal(null);
      }
    });
  };

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) {
      alert('Please enter a branch name (e.g., feature/login).');
      return;
    }
    vscode.postMessage({
      type: 'CREATE_BRANCH',
      branchName: newBranchName.trim()
    });
    setNewBranchName('');
  };

  const handleSwitchBranch = (bName: string) => {
    if (!bName || bName === status?.branch) return;
    setConfirmModal({
      title: `🌿 Switch Branch to "${bName}"`,
      description: `Switch your workspace to branch "${bName}".`,
      consequences: [
        'GitWizard captures a safety backup before switching.',
        'Your editor will update to show the files on that branch.'
      ],
      confirmButtonText: `Switch to ${bName}`,
      onConfirm: () => {
        vscode.postMessage({ type: 'SWITCH_BRANCH', branchName: bName });
        setSelectedBranch(bName);
        setConfirmModal(null);
      }
    });
  };

  const handleInstantManualSave = () => {
    const label = prompt('Name this checkpoint (e.g. before AI refactor):', 'manual-save');
    if (label !== null) {
      vscode.postMessage({
        type: 'CREATE_CHECKPOINT',
        label: label.trim() || 'manual-save'
      });
    }
  };

  const handleAskRestoreSnapshot = (snap: SnapshotMetadata) => {
    const isAuto = snap.label.startsWith('auto-');
    const cleanName = isAuto ? snap.label.replace('auto-', 'Auto-Save: ') : snap.label;

    setConfirmModal({
      title: `⏪ Rewind Workspace to: "${cleanName}"`,
      description: `Restore your files to the state captured at ${new Date(snap.timestamp).toLocaleTimeString()}.`,
      consequences: [
        'A safety backup of your CURRENT workspace will be created first.',
        'Files modified since this checkpoint will be replaced by the checkpoint version.',
        'You can always return to your current state using the Undo time machine.'
      ],
      confirmButtonText: 'Yes, Rewind Workspace Safely',
      onConfirm: () => {
        vscode.postMessage({
          type: 'RESTORE_CHECKPOINT',
          snapshotId: snap.id
        });
        setConfirmModal(null);
      }
    });
  };

  const handleRunSplit = () => {
    const filesA = Object.keys(selectedForA).filter((f) => selectedForA[f]);
    const filesB = allDirtyFiles.filter((f) => !selectedForA[f]);

    if (filesA.length === 0) {
      alert('Please select at least one file for Group A');
      return;
    }
    if (filesB.length === 0) {
      alert('Group B must also have at least one file.');
      return;
    }

    setConfirmModal({
      title: '✂️ Confirm Safe File Split',
      description: 'Separate your messy AI edits into two clean, dedicated branches.',
      consequences: [
        `Branch "${branchA}": gets ${filesA.length} selected file(s).`,
        `Branch "${branchB}": gets ${filesB.length} remaining file(s).`,
        'A full backup of all files is taken before any branch is touched.'
      ],
      confirmButtonText: 'Yes, Split Work Safely',
      onConfirm: () => {
        vscode.postMessage({
          type: 'SPLIT_CHANGES',
          request: {
            groups: [
              { branchName: branchA.trim(), commitMessage: commitA.trim(), files: filesA },
              { branchName: branchB.trim(), commitMessage: commitB.trim(), files: filesB }
            ]
          }
        });
        setConfirmModal(null);
      }
    });
  };

  const handlePromoteToNewRepo = () => {
    setConfirmModal({
      title: '🚀 Publish Standalone GitHub Repo',
      description: `Promote branch "${promoteSourceBranch}" into its own brand new GitHub repository "${promoteRepoName}".`,
      consequences: [
        'Creates remote repository on GitHub via GitHub CLI.',
        'Pushes branch contents as the initial "main" branch.'
      ],
      confirmButtonText: 'Publish New Repo',
      onConfirm: () => {
        vscode.postMessage({
          type: 'SPLIT_TO_NEW_REPO',
          options: {
            sourceBranch: promoteSourceBranch.trim(),
            newRepoName: promoteRepoName.trim(),
            targetBranch: 'main',
            visibility: promoteVisibility,
            description: 'Standalone project generated via GitWizard'
          }
        });
        setConfirmModal(null);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
      {/* Confirmation Modal Overlay */}
      {confirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid var(--vscode-focusBorder, #007acc)',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '360px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {confirmModal.title}
            </div>
            <div style={{ opacity: 0.9, lineHeight: '1.4' }}>{confirmModal.description}</div>
            
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--vscode-textLink-foreground)' }}>🛡️ Safety Checklist:</div>
              {confirmModal.consequences.map((c, i) => (
                <div key={i} style={{ opacity: 0.85 }}>• {c}</div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  padding: '6px 14px',
                  background: 'var(--vscode-button-background, #007acc)',
                  color: 'var(--vscode-button-foreground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {confirmModal.confirmButtonText}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>CURRENT BRANCH</div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--vscode-textLink-foreground)' }}>
              🌿 {status?.branch || 'main'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '10px',
                fontWeight: 600,
                background: allDirtyFiles.length > 0 ? 'var(--vscode-inputValidation-warningBackground, #855a00)' : 'var(--vscode-testing-iconPassed, #388a34)',
                color: '#fff'
              }}
            >
              {allDirtyFiles.length > 0 ? `🟡 ${allDirtyFiles.length} files dirty` : '🟢 Workspace Clean'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={handleInstantManualSave}
            title="Take an instant safety snapshot before prompting AI"
            style={{
              flex: 1,
              padding: '5px',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--vscode-foreground)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📸 Quick Snapshot
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {[
          { id: 'daily', label: '⚡ Everyday' },
          { id: 'timeline', label: '⏳ Rewind' },
          { id: 'split', label: '✂️ Split' },
          { id: 'promote', label: '🚀 Repo' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '7px 4px',
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

      {/* TAB 1: EVERYDAY DECK */}
      {activeTab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Section: Save changes (Commit) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
              💾 Save Changes (Commit)
            </div>
            <div style={{ fontSize: '11px', opacity: 0.75, marginBottom: '6px' }}>
              Stage and save your work safely with a message.
            </div>
            <input
              type="text"
              placeholder="e.g. Added login button & responsive styling"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickCommit()}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '4px',
                fontSize: '11px',
                boxSizing: 'border-box',
                marginBottom: '6px'
              }}
            />
            <button
              onClick={handleQuickCommit}
              disabled={allDirtyFiles.length === 0}
              style={{
                width: '100%',
                padding: '7px',
                background: allDirtyFiles.length > 0 ? 'var(--vscode-button-background)' : 'rgba(255,255,255,0.1)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '4px',
                cursor: allDirtyFiles.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              {allDirtyFiles.length > 0 ? `💾 Save ${allDirtyFiles.length} Modified File(s)` : 'No Changes to Save'}
            </button>
          </div>

          {/* Section: Remote Sync (Push & Pull) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
              ☁️ GitHub Sync
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handleAskSafePush}
                style={{
                  padding: '7px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ⬆️ Send (Push)
              </button>
              <button
                onClick={handleAskSafePull}
                style={{
                  padding: '7px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ⬇️ Update (Pull)
              </button>
            </div>
            <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '6px' }}>
              🛡️ Safe Pull automatically restores if remote changes conflict.
            </div>
          </div>

          {/* Section: Branches */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
              🌿 Branches
            </div>
            {localBranches.length > 1 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', opacity: 0.75, marginBottom: '2px' }}>Switch to Branch:</div>
                <select
                  value={status?.branch || ''}
                  onChange={(e) => handleSwitchBranch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px',
                    background: 'var(--vscode-dropdown-background)',
                    color: 'var(--vscode-dropdown-foreground)',
                    border: '1px solid var(--vscode-dropdown-border)',
                    borderRadius: '4px'
                  }}
                >
                  {localBranches.map((b) => (
                    <option key={b} value={b}>
                      {b} {b === status?.branch ? '(current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="New branch (e.g. feature/navbar)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              />
              <button
                onClick={handleCreateBranch}
                style={{
                  padding: '5px 10px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Section: Uncommit */}
          <button
            onClick={handleAskSafeUncommit}
            style={{
              padding: '8px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--vscode-foreground)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: 0.85
            }}
          >
            ↩️ Undo Last Commit (Keeps All Files Modified)
          </button>
        </div>
      )}

      {/* TAB 2: VIRTUAL TIMELINE TREE */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '12px' }}>⏳ Retrospective Time Machine</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>Passive Flight Recorder</span>
          </div>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            Click <b>Rewind</b> to safely return your workspace to any previous point. A safety backup is always taken first.
          </div>

          {/* Tree Nodes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {/* Current State Node */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '6px',
                borderLeft: '3px solid var(--vscode-focusBorder, #007acc)'
              }}
            >
              <div style={{ fontSize: '14px' }}>📍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Right Now (Working Directory)</div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                  {allDirtyFiles.length > 0 ? `${allDirtyFiles.length} unsaved changes` : 'Clean state'}
                </div>
              </div>
            </div>

            {/* Checkpoints & Auto-saves */}
            {snapshots.length === 0 ? (
              <div style={{ fontSize: '11px', opacity: 0.6, padding: '12px', textAlign: 'center' }}>
                No snapshots recorded yet. Auto-saves will appear here as you prompt AI!
              </div>
            ) : (
              snapshots.map((snap) => {
                const isAuto = snap.label.startsWith('auto-');
                const displayName = isAuto ? snap.label.replace('auto-', 'Auto-Save: ') : snap.label;
                const timeStr = new Date(snap.timestamp).toLocaleTimeString();

                return (
                  <div
                    key={snap.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '6px',
                      borderLeft: isAuto ? '3px solid #e5a50a' : '3px solid #388a34'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '13px' }}>{isAuto ? '⏱️' : '📸'}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '11px' }}>{displayName}</div>
                        <div style={{ fontSize: '10px', opacity: 0.5 }}>{timeStr} • branch: {snap.branch}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAskRestoreSnapshot(snap)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: 'var(--vscode-button-background)',
                        color: 'var(--vscode-button-foreground)',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      ⏪ Rewind
                    </button>
                  </div>
                );
              })
            )}

            {/* Recent Git Reflog Actions */}
            {actions.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8, marginTop: '10px' }}>
                  📜 Recent Git History:
                </div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {actions.map((act, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '10px',
                        opacity: 0.8,
                        padding: '4px 6px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '4px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--vscode-textLink-foreground)' }}>{act.selector}</span>: {act.title}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VISUAL FILE SPLITTER */}
      {activeTab === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '11px', opacity: 0.85 }}>
            AI modified multiple files at once? Divide them cleanly into two separate feature branches.
          </p>

          {allDirtyFiles.length < 2 ? (
            <div style={{ fontSize: '11px', opacity: 0.7, padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
              Requires at least 2 modified files to split. Currently {allDirtyFiles.length} file(s) dirty.
            </div>
          ) : (
            <>
              {/* Branch A Config */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px', color: 'var(--vscode-textLink-foreground)' }}>
                  🌿 Branch A (Selected Files):
                </div>
                <input
                  type="text"
                  value={branchA}
                  onChange={(e) => setBranchA(e.target.value)}
                  placeholder="Branch name (e.g. feature/part-1)"
                  style={{ width: '100%', marginBottom: '4px', padding: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  value={commitA}
                  onChange={(e) => setCommitA(e.target.value)}
                  placeholder="Commit message"
                  style={{ width: '100%', padding: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Visual File Selection Checklist */}
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  Select files to place into Branch A (unselected go to Branch B):
                </div>
                {allDirtyFiles.map((file) => (
                  <label key={file} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', padding: '3px 0' }}>
                    <input
                      type="checkbox"
                      checked={!!selectedForA[file]}
                      onChange={(e) => setSelectedForA({ ...selectedForA, [file]: e.target.checked })}
                    />
                    <span style={{ fontFamily: 'monospace' }}>{file}</span>
                  </label>
                ))}
              </div>

              {/* Branch B Config */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px', color: '#e5a50a' }}>
                  🌿 Branch B (Remaining Files):
                </div>
                <input
                  type="text"
                  value={branchB}
                  onChange={(e) => setBranchB(e.target.value)}
                  placeholder="Branch name (e.g. feature/part-2)"
                  style={{ width: '100%', marginBottom: '4px', padding: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  value={commitB}
                  onChange={(e) => setCommitB(e.target.value)}
                  placeholder="Commit message"
                  style={{ width: '100%', padding: '4px', fontSize: '11px', boxSizing: 'border-box' }}
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
                ✂️ Review & Split Changes
              </button>
            </>
          )}
        </div>
      )}

      {/* TAB 4: PROMOTE TO NEW REPO */}
      {activeTab === 'promote' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '11px', opacity: 0.85 }}>
            Promote an experimental branch into its own brand new GitHub repository.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>Source Branch:</div>
            <input
              type="text"
              value={promoteSourceBranch}
              onChange={(e) => setPromoteSourceBranch(e.target.value)}
              placeholder="e.g. feature/my-new-app"
              style={{ padding: '5px', fontSize: '11px' }}
            />

            <div style={{ fontSize: '11px', fontWeight: 600 }}>New GitHub Repository Name:</div>
            <input
              type="text"
              value={promoteRepoName}
              onChange={(e) => setPromoteRepoName(e.target.value)}
              placeholder="e.g. my-new-app"
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
              padding: '8px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            🚀 Publish Standalone Repository
          </button>
        </div>
      )}
    </div>
  );
};
