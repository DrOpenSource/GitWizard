import React, { useState, useEffect } from 'react';

declare function acquireVsCodeApi(): {
  postMessage(msg: any): void;
  getState(): any;
  setState(state: any): void;
};

// Safe acquire vscode API (singleton)
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

export const App: React.FC = () => {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [activeTab, setActiveTab] = useState<'checkpoint' | 'split' | 'sync' | 'timeline'>('checkpoint');

  useEffect(() => {
    // Request initial status
    vscode.postMessage({ type: 'GET_STATUS' });

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === 'STATUS_UPDATE') {
        setStatus(data.status);
        setSnapshots(data.snapshots || []);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  const totalDirty = status
    ? status.modified.length + status.staged.length + status.untracked.length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header & Status Card */}
      <div
        style={{
          background: 'var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.06))',
          padding: '12px',
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
              background: totalDirty > 0 ? 'var(--vscode-inputValidation-warningBackground, #855a00)' : 'var(--vscode-testing-iconPassed, #388a34)',
              color: '#fff'
            }}
          >
            {totalDirty > 0 ? `${totalDirty} modified` : 'Clean'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <button
          onClick={() => setActiveTab('checkpoint')}
          style={{
            padding: '8px',
            background: activeTab === 'checkpoint' ? 'var(--vscode-button-background)' : 'transparent',
            color: activeTab === 'checkpoint' ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
            border: '1px solid var(--vscode-button-border, rgba(255,255,255,0.15))',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🛡️ Checkpoint
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          style={{
            padding: '8px',
            background: activeTab === 'timeline' ? 'var(--vscode-button-background)' : 'transparent',
            color: activeTab === 'timeline' ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
            border: '1px solid var(--vscode-button-border, rgba(255,255,255,0.15))',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ⏪ Time Machine ({snapshots.length})
        </button>
      </div>

      {/* Checkpoint Tab */}
      {activeTab === 'checkpoint' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', opacity: 0.85 }}>
            Save working tree instantly before asking AI to rewrite code. Non-destructive; won't pollute git log.
          </p>
          <input
            type="text"
            placeholder="Checkpoint label (e.g., before auth refactor)"
            value={checkpointLabel}
            onChange={(e) => setCheckpointLabel(e.target.value)}
            style={{
              padding: '7px 10px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '4px',
              outline: 'none',
              fontSize: '12px'
            }}
          />
          <button
            onClick={handleCreateCheckpoint}
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
            📸 Capture Safety Checkpoint
          </button>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {snapshots.length === 0 ? (
            <p style={{ fontSize: '12px', opacity: 0.7 }}>No checkpoints created yet.</p>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.05))',
                  borderRadius: '4px',
                  border: '1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>{snap.label}</div>
                  <div style={{ fontSize: '10px', opacity: 0.6 }}>
                    {new Date(snap.timestamp).toLocaleTimeString()} · branch: {snap.branch}
                  </div>
                </div>
                <button
                  onClick={() => handleRestoreCheckpoint(snap.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                    color: 'var(--vscode-button-secondaryForeground, #ffffff)',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
