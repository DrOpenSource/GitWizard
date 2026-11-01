import React, { useState, useEffect } from 'react';
import { getFileCategory, getCategoryBadge, FileCategory } from '../engine/file-category';

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
  isRepo?: boolean;
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
  relativeTime?: string;
}

export interface LicenseStatus {
  isPro: boolean;
  tier: 'pro' | 'free';
  status: 'active_license' | 'active_trial' | 'expired_trial' | 'free';
  email?: string;
  trialDaysRemaining?: number;
  reason?: string;
}

export interface DetectedSecret {
  ruleId: string;
  ruleName: string;
  file: string;
  line: number;
  rawSecret: string;
  maskedSecret: string;
  entropy?: number;
}

interface ConfirmModalData {
  title: string;
  description: string;
  consequences: string[];
  confirmButtonText: string;
  onConfirm: () => void;
  affectedFiles?: Array<{ path: string; status?: 'modified' | 'added' | 'deleted' }>;
  safetyGuarantee?: string;
  isLoadingDiff?: boolean;
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [actions, setActions] = useState<HumanGitAction[]>([]);
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'timeline' | 'split' | 'promote'>('daily');

  // Pro State
  const [proStatus, setProStatus] = useState<LicenseStatus | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseFeedback, setLicenseFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Sprint 8: Secret Radar & Branch Guard Alerts
  const [secretRadarAlert, setSecretRadarAlert] = useState<{
    secrets: DetectedSecret[];
    message: string;
  } | null>(null);
  const [branchGuardAlert, setBranchGuardAlert] = useState<{
    suggestedFeatureBranch: string;
    message: string;
  } | null>(null);

  // Sprint 9: Surgical File Rewind & AI Semantic Auto-Split
  const [isSplittingAI, setIsSplittingAI] = useState(false);
  const [aiSplitPlan, setAiSplitPlan] = useState<{
    groups: Array<{ branch: string; commitMessage: string; rationale: string; files: string[] }>;
    totalFiles: number;
    requiresPro?: boolean;
    error?: string;
  } | null>(null);
  const [fileRewindTarget, setFileRewindTarget] = useState<{
    snapshot: SnapshotMetadata;
    selectedFile: string;
  } | null>(null);

  // Sprint 10: Smart AI Conflict Resolver & Cloud Sync
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [activeConflictResolution, setActiveConflictResolution] = useState<{
    filePath: string;
    resolvedContent: string;
    rationale: string;
    resolutionSource: 'ai' | 'heuristic';
    syntaxValid: boolean;
  } | null>(null);
  const [cloudSyncPassphrase, setCloudSyncPassphrase] = useState('');
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

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

  // Phase 1 Onboarding & Identity Airbag State
  const [isInitializingRepo, setIsInitializingRepo] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [authorNameInput, setAuthorNameInput] = useState('');
  const [authorEmailInput, setAuthorEmailInput] = useState('');
  const [pendingCommitMessage, setPendingCommitMessage] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Sprint 11 Phase 2 Settings & Ergonomics State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsProvider, setSettingsProvider] = useState<'gemini' | 'openai' | 'ollama'>('gemini');
  const [settingsApiKey, setSettingsApiKey] = useState('');
  const [hasConfiguredKey, setHasConfiguredKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [settingsBaseUrl, setSettingsBaseUrl] = useState('http://localhost:11434');
  const [settingsModel, setSettingsModel] = useState('llama3.2');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const [settingsReason, setSettingsReason] = useState<string | null>(null);

  // Sprint 11 Phase 4 Remote Sync & GitHub Onboarding Guard
  const [showConnectRemoteModal, setShowConnectRemoteModal] = useState(false);
  const [remoteUrlInput, setRemoteUrlInput] = useState('');
  const [remoteUrlError, setRemoteUrlError] = useState<string | null>(null);
  const [isConfiguringRemote, setIsConfiguringRemote] = useState(false);
  const [splitRepoFallbackUrl, setSplitRepoFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    vscode.postMessage({ type: 'GET_STATUS' });
    vscode.postMessage({ type: 'GET_AI_CONFIG' });

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
        if (data.proStatus) setProStatus(data.proStatus);
      } else if (data.type === 'PRO_STATUS_UPDATE') {
        setProStatus(data.proStatus);
      } else if (data.type === 'OPEN_SETTINGS') {
        setShowSettingsModal(true);
        if (data.reason) setSettingsReason(data.reason);
        vscode.postMessage({ type: 'GET_AI_CONFIG' });
      } else if (data.type === 'AI_CONFIG_UPDATE') {
        if (data.config) {
          setSettingsProvider(data.config.provider || 'gemini');
          if (data.config.provider === 'gemini') {
            setHasConfiguredKey(Boolean(data.config.hasGeminiKey));
            setMaskedKey(data.config.maskedGeminiKey || '');
          } else if (data.config.provider === 'openai') {
            setHasConfiguredKey(Boolean(data.config.hasOpenAiKey));
            setMaskedKey(data.config.maskedOpenAiKey || '');
          } else {
            setHasConfiguredKey(false);
            setMaskedKey('');
          }
          if (data.config.ollamaBaseUrl) setSettingsBaseUrl(data.config.ollamaBaseUrl);
          if (data.config.ollamaModel) setSettingsModel(data.config.ollamaModel);
        }
      } else if (data.type === 'AI_CONFIG_SAVED') {
        if (data.success) {
          setSettingsToast('Settings saved successfully! ✨');
          setTimeout(() => setSettingsToast(null), 3000);
        } else {
          setSettingsToast(data.error || 'Failed to save settings');
          setTimeout(() => setSettingsToast(null), 3000);
        }
      } else if (data.type === 'AI_CONNECTION_TEST_RESULT') {
        setIsTestingConnection(false);
        setConnectionFeedback({ success: data.success, message: data.message });
      } else if (data.type === 'AI_COMMIT_RESPONSE') {
        setIsGeneratingAI(false);
        if (data.success && data.commitMessage) {
          setCommitMessage(data.commitMessage);
          setAiError(null);
        } else if (data.requiresPro) {
          setShowLicenseModal(true);
          setAiError(data.error || 'Pro license or active trial required.');
        } else {
          setAiError(data.error || 'Failed to generate commit message.');
        }
      } else if (data.type === 'AUTO_SPLIT_PLAN_RESPONSE') {
        setIsSplittingAI(false);
        const plan = data.plan;
        if (plan?.requiresPro) {
          setShowLicenseModal(true);
          setAiError(plan.error || 'Pro license or active trial required.');
        } else if (plan?.success && plan.groups?.length) {
          setAiSplitPlan(plan);
          if (plan.groups.length >= 2) {
            setBranchA(plan.groups[0].branch);
            setCommitA(plan.groups[0].commitMessage);
            const selA: Record<string, boolean> = {};
            plan.groups[0].files.forEach((f: string) => { selA[f] = true; });
            setSelectedForA(selA);
            setBranchB(plan.groups[1].branch);
            setCommitB(plan.groups[1].commitMessage);
          }
        } else {
          setAiError(plan?.error || 'Failed to auto-split dirty files.');
        }
      } else if (data.type === 'FILE_CONFLICT_RESOLVED') {
        setIsResolvingConflict(false);
        if (data.resolution) {
          setActiveConflictResolution(data.resolution);
        } else if (data.error) {
          setAiError(data.error);
        }
      } else if (data.type === 'SECRET_RADAR_TRIGGERED') {
        setSecretRadarAlert({
          secrets: data.secrets || [],
          message: data.message
        });
      } else if (data.type === 'BRANCH_GUARD_TRIGGERED') {
        setBranchGuardAlert({
          suggestedFeatureBranch: data.suggestedFeatureBranch || 'feature/updates',
          message: data.message
        });
      } else if (data.type === 'SECRETS_REMEDIATED') {
        setSecretRadarAlert(null);
      } else if (data.type === 'BRANCH_RELOCATED') {
        setBranchGuardAlert(null);
      } else if (data.type === 'REQUIRE_GIT_IDENTITY') {
        setPendingCommitMessage(data.pendingCommitMessage || commitMessage);
        setShowIdentityModal(true);
      } else if (data.type === 'REPO_INITIALIZED') {
        setIsInitializingRepo(false);
      } else if (data.type === 'SNAPSHOT_DIFF_PREVIEW') {
        setConfirmModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            isLoadingDiff: false,
            affectedFiles: data.files || []
          };
        });
      } else if (data.type === 'REQUIRE_REMOTE_URL') {
        setShowConnectRemoteModal(true);
        setRemoteUrlError(null);
      } else if (data.type === 'REMOTE_URL_CONFIGURED') {
        setIsConfiguringRemote(false);
        if (data.success) {
          setShowConnectRemoteModal(false);
          setRemoteUrlInput('');
          setRemoteUrlError(null);
        } else {
          setRemoteUrlError(data.error || 'Failed to connect repository URL.');
        }
      } else if (data.type === 'SPLIT_REPO_FALLBACK') {
        if (data.webFallbackUrl) {
          setSplitRepoFallbackUrl(data.webFallbackUrl);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSaveSettings = () => {
    vscode.postMessage({
      type: 'SAVE_AI_CONFIG',
      provider: settingsProvider,
      geminiApiKey: settingsProvider === 'gemini' ? (settingsApiKey.trim() || undefined) : undefined,
      openaiApiKey: settingsProvider === 'openai' ? (settingsApiKey.trim() || undefined) : undefined,
      ollamaBaseUrl: settingsBaseUrl.trim(),
      ollamaModel: settingsModel.trim()
    });
    setSettingsApiKey('');
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setConnectionFeedback(null);
    vscode.postMessage({
      type: 'TEST_AI_CONNECTION',
      options: {
        provider: settingsProvider,
        apiKey: settingsApiKey.trim() || undefined,
        baseUrl: settingsBaseUrl.trim(),
        model: settingsModel.trim()
      }
    });
  };

  const handleConnectRemote = () => {
    if (!remoteUrlInput.trim()) {
      setRemoteUrlError('Please enter a valid GitHub repository URL.');
      return;
    }
    setIsConfiguringRemote(true);
    setRemoteUrlError(null);
    vscode.postMessage({
      type: 'SET_REMOTE_URL',
      url: remoteUrlInput.trim(),
      remote: 'origin',
      autoPush: true
    });
  };

  const allDirtyFiles = status
    ? Array.from(new Set([...status.staged, ...status.modified, ...status.untracked]))
    : [];

  // Pro Handlers
  const handleGenerateAICommit = () => {
    setIsGeneratingAI(true);
    setAiError(null);
    vscode.postMessage({ type: 'GENERATE_AI_COMMIT' });
  };

  const handleActivateLicense = () => {
    if (!licenseKeyInput.trim()) {
      setLicenseFeedback({ text: 'Please enter a valid license key.', isError: true });
      return;
    }
    vscode.postMessage({
      type: 'ACTIVATE_LICENSE',
      key: licenseKeyInput.trim()
    });
    setLicenseFeedback({ text: 'Validating key...', isError: false });
    setTimeout(() => {
      vscode.postMessage({ type: 'GET_PRO_STATUS' });
    }, 500);
  };

  const handleRemediateSecrets = () => {
    if (!secretRadarAlert) return;
    vscode.postMessage({
      type: 'REMEDIATE_SECRETS',
      secrets: secretRadarAlert.secrets
    });
  };

  const handleOverrideSecretCommit = () => {
    vscode.postMessage({
      type: 'SAFE_COMMIT',
      message: commitMessage.trim(),
      ignoreSecrets: true
    });
    setSecretRadarAlert(null);
  };

  const handleRelocateBranch = () => {
    if (!branchGuardAlert) return;
    vscode.postMessage({
      type: 'RELOCATE_BRANCH',
      newBranch: branchGuardAlert.suggestedFeatureBranch
    });
  };

  const handleOverrideBranchCommit = () => {
    vscode.postMessage({
      type: 'SAFE_COMMIT',
      message: commitMessage.trim(),
      allowProtected: true
    });
    setBranchGuardAlert(null);
  };

  // Sprint 9 Pro Handlers
  const handleAutoSplitAI = () => {
    setIsSplittingAI(true);
    setAiError(null);
    vscode.postMessage({ type: 'PLAN_AUTO_SPLIT' });
  };

  const handleExecuteAutoSplitPlan = () => {
    if (!aiSplitPlan || !aiSplitPlan.groups || aiSplitPlan.groups.length === 0) return;
    setConfirmModal({
      title: '✂️ Execute AI Multi-Branch Split',
      description: `GitWizard will create ${aiSplitPlan.groups.length} branches and commit the files cleanly into each one:`,
      consequences: aiSplitPlan.groups.map(g => `Branch "${g.branch}": ${g.files.length} file(s) - "${g.commitMessage}"`),
      confirmButtonText: 'Yes, Execute AI Split',
      onConfirm: () => {
        vscode.postMessage({
          type: 'EXECUTE_AUTO_SPLIT',
          groups: aiSplitPlan.groups
        });
        setAiSplitPlan(null);
        setConfirmModal(null);
      }
    });
  };

  const handleTriggerFileRewind = (snap: SnapshotMetadata) => {
    setFileRewindTarget({
      snapshot: snap,
      selectedFile: allDirtyFiles[0] || ''
    });
  };

  const handleConfirmFileRewind = () => {
    if (!fileRewindTarget || !fileRewindTarget.selectedFile.trim()) return;
    const { snapshot, selectedFile } = fileRewindTarget;
    vscode.postMessage({
      type: 'REWIND_FILE',
      snapshotId: snapshot.id,
      filePath: selectedFile.trim()
    });
    setFileRewindTarget(null);
  };

  // Sprint 10 Pro Handlers: Conflict Resolution & Cloud Sync
  const handleTriggerConflictResolution = () => {
    if (!status?.conflicted || status.conflicted.length === 0) return;
    setIsResolvingConflict(true);
    setAiError(null);
    vscode.postMessage({
      type: 'RESOLVE_CONFLICT_AI',
      filePath: status.conflicted[0]
    });
  };

  const handleApplyConflictResolution = () => {
    if (!activeConflictResolution) return;
    vscode.postMessage({
      type: 'APPLY_CONFLICT_RESOLUTIONS',
      resolutions: [activeConflictResolution]
    });
    setActiveConflictResolution(null);
  };

  const handleAbortConflict = () => {
    vscode.postMessage({ type: 'ABORT_CONFLICT' });
    setActiveConflictResolution(null);
  };

  const handleCloudPush = () => {
    vscode.postMessage({
      type: 'PUSH_CLOUD_SYNC',
      remote: 'origin',
      passphrase: cloudSyncPassphrase.trim() || undefined
    });
    setShowCloudSyncModal(false);
  };

  const handleCloudPull = () => {
    vscode.postMessage({
      type: 'PULL_CLOUD_SYNC',
      remote: 'origin',
      passphrase: cloudSyncPassphrase.trim() || undefined
    });
    setShowCloudSyncModal(false);
  };

  // Phase 1 Handlers: Safe Mode & Identity Airbag
  const handleInitRepo = () => {
    setIsInitializingRepo(true);
    vscode.postMessage({ type: 'INIT_REPO' });
  };

  const handleSaveIdentityAndCommit = () => {
    if (!authorNameInput.trim()) {
      setIdentityError('Please enter a display name or nickname.');
      return;
    }
    if (!authorEmailInput.trim() || !authorEmailInput.includes('@')) {
      setIdentityError('Please enter a valid email address (e.g. user@example.com).');
      return;
    }
    setIdentityError(null);
    setShowIdentityModal(false);

    vscode.postMessage({
      type: 'SAFE_COMMIT',
      message: pendingCommitMessage.trim() || commitMessage.trim(),
      authorName: authorNameInput.trim(),
      authorEmail: authorEmailInput.trim()
    });
  };

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
      safetyGuarantee: 'GitWizard automatically captures a safety snapshot of your current screen before rewinding. You can return to your exact current work at any time.',
      isLoadingDiff: true,
      affectedFiles: [],
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

    vscode.postMessage({
      type: 'PREVIEW_SNAPSHOT_DIFF',
      snapshotId: snap.id
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
      {/* Git Author Identity Modal */}
      {showIdentityModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10005,
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
            <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>👤</span> Author Identity Needed
            </div>
            <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: '1.4' }}>
              Who should get credit for your work? Git needs a display name and email to save your work history on your computer.
            </div>

            {identityError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              >
                {identityError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', opacity: 0.85, display: 'block', marginBottom: '3px' }}>
                  Your Name or Nickname:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={authorNameInput}
                  onChange={(e) => setAuthorNameInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', opacity: 0.85, display: 'block', marginBottom: '3px' }}>
                  Your Email:
                </label>
                <input
                  type="email"
                  placeholder="e.g. alex@example.com"
                  value={authorEmailInput}
                  onChange={(e) => setAuthorEmailInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setShowIdentityModal(false);
                  setIdentityError(null);
                }}
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
                onClick={handleSaveIdentityAndCommit}
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
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Connect Remote Modal (Phase 4) */}
      {showConnectRemoteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10006,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.35)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd', fontWeight: 700, fontSize: '13px' }}>
              <span>☁️</span> Connect to GitHub (Cloud Backup)
            </div>

            <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: '1.4' }}>
              Your saves are currently safe on your computer. Connect a remote GitHub repository to enable 1-click cloud sync, offsite backups, and collaboration.
            </div>

            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                lineHeight: '1.4'
              }}
            >
              💡 <b>Tip</b>: Create a new repository at <code>github.com/new</code>, then paste its HTTPS clone URL below.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600 }}>GitHub Repository URL:</label>
              <input
                type="text"
                placeholder="https://github.com/your-username/your-repo.git"
                value={remoteUrlInput}
                onChange={(e) => setRemoteUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnectRemote()}
                style={{
                  padding: '7px 8px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              />
              {remoteUrlError && (
                <div style={{ color: '#fca5a5', fontSize: '10px', marginTop: '2px' }}>
                  {remoteUrlError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setShowConnectRemoteModal(false);
                  setRemoteUrlError(null);
                }}
                style={{
                  padding: '6px 12px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConnectRemote}
                disabled={isConfiguringRemote}
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: isConfiguringRemote ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}
              >
                {isConfiguringRemote ? 'Connecting...' : '🔗 Connect & Back Up (1-Click)'}
              </button>
            </div>
          </div>
        </div>
      )}

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

            {confirmModal.safetyGuarantee && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: '#6ee7b7',
                  lineHeight: '1.4'
                }}
              >
                🛡️ <b>Safe Rewind Guarantee</b>: {confirmModal.safetyGuarantee}
              </div>
            )}

            {confirmModal.isLoadingDiff ? (
              <div style={{ fontSize: '11px', opacity: 0.7, padding: '4px 0' }}>
                ⏳ Scanning affected files...
              </div>
            ) : confirmModal.affectedFiles && confirmModal.affectedFiles.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>
                  📄 Affected Files ({confirmModal.affectedFiles.length}):
                </div>
                <div
                  style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  {confirmModal.affectedFiles.map((f, idx) => {
                    const cat = getFileCategory(f.path);
                    const badge = getCategoryBadge(cat);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          fontSize: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontWeight: 600
                            }}
                          >
                            {badge.icon} {badge.label}
                          </span>
                          <span style={{ fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {f.path}
                          </span>
                        </div>
                        {f.status && (
                          <span style={{ opacity: 0.6, fontSize: '9px', textTransform: 'capitalize' }}>
                            {f.status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            
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

      {/* Surgical Single-File Rewind Modal */}
      {fileRewindTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.35)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📄</span> Rewind Single File
              </div>
              <button
                onClick={() => setFileRewindTarget(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: '1.4' }}>
              Restore an individual file from snapshot <code>{fileRewindTarget.snapshot.label}</code>. All your other modified files remain 100% untouched.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>File Path to Rewind:</div>
              <input
                type="text"
                placeholder="e.g. src/index.ts or package.json"
                value={fileRewindTarget.selectedFile}
                onChange={(e) => setFileRewindTarget({ ...fileRewindTarget, selectedFile: e.target.value })}
                style={{
                  padding: '7px 8px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              />
              {allDirtyFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>Quick select from modified files:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                    {allDirtyFiles.map(f => (
                      <button
                        key={f}
                        onClick={() => setFileRewindTarget({ ...fileRewindTarget, selectedFile: f })}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: fileRewindTarget.selectedFile === f ? 'var(--vscode-button-background)' : 'rgba(255,255,255,0.05)',
                          color: fileRewindTarget.selectedFile === f ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                          cursor: 'pointer',
                          fontFamily: 'monospace'
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => setFileRewindTarget(null)}
                style={{
                  padding: '5px 10px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFileRewind}
                disabled={!fileRewindTarget.selectedFile.trim()}
                style={{
                  padding: '6px 12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: !fileRewindTarget.selectedFile.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                ⏮️ Rewind This File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Merge Conflict Resolution Preview Modal */}
      {activeConflictResolution && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10003,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
                <span>🛡️</span> AI Conflict Resolution Ready
              </div>
              <button
                onClick={() => setActiveConflictResolution(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '11px', opacity: 0.9 }}>
              File: <code style={{ color: '#a5b4fc', fontWeight: 600 }}>{activeConflictResolution.filePath}</code>
            </div>

            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                lineHeight: '1.4'
              }}
            >
              💡 <b>Synthesis Rationale</b>: {activeConflictResolution.rationale}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>Resolved Code Preview (0 conflict markers):</div>
              <pre
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {activeConflictResolution.resolvedContent}
              </pre>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setActiveConflictResolution(null)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Discard
              </button>
              <button
                onClick={handleApplyConflictResolution}
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '11px',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                }}
              >
                ✅ Accept Resolution & Stage File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Sync Encryption Key Modal */}
      {showCloudSyncModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10004,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #3b82f6',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '360px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.35)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: '#93c5fd' }}>
                <span>☁️</span> Private GitHub Cloud Sync
              </div>
              <button
                onClick={() => setShowCloudSyncModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '11px', opacity: 0.85, lineHeight: '1.4' }}>
              AES-256-GCM encrypted snapshots synced directly to your repository's <code>refs/gitwizard/cloud-sync</code>.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>Sync Passphrase (optional):</div>
              <input
                type="password"
                placeholder="Leave blank for auto-derived key"
                value={cloudSyncPassphrase}
                onChange={(e) => setCloudSyncPassphrase(e.target.value)}
                style={{
                  padding: '6px 8px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={handleCloudPull}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--vscode-foreground)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                ⬇️ Pull from Remote
              </button>
              <button
                onClick={handleCloudPush}
                style={{
                  padding: '6px 12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                ☁️ Push Encrypted Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License Activation Modal */}
      {showLicenseModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #6366f1',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '360px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(99,102,241,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⭐</span> GitWizard Pro License
              </div>
              <button
                onClick={() => {
                  setShowLicenseModal(false);
                  setLicenseFeedback(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '11px', opacity: 0.85, lineHeight: '1.4' }}>
              One-time $49 payment ($29 Early Bird launch). 0 subscriptions. Forever yours.
            </div>

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
              <div style={{ fontWeight: 600, color: '#a5b4fc' }}>Current Tier:</div>
              {proStatus?.status === 'active_license' && (
                <div style={{ color: '#34d399' }}>✅ Lifetime License active for: {proStatus.email}</div>
              )}
              {proStatus?.status === 'active_trial' && (
                <div style={{ color: '#60a5fa' }}>✨ 14-Day Free Trial active ({proStatus.trialDaysRemaining ?? 14} days remaining)</div>
              )}
              {proStatus?.status === 'expired_trial' && (
                <div style={{ color: '#f87171' }}>⏳ Trial has expired. Enter key to continue using Pro features.</div>
              )}
              {(!proStatus || proStatus.status === 'free') && (
                <div style={{ color: '#94a3b8' }}>Free Tier (Standard safety checkpoints active)</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>Enter Lifetime License Key:</div>
              <input
                type="text"
                placeholder="GWPRO-LIFETIME.<email>.<time>.<sig>"
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                style={{
                  padding: '7px 8px',
                  background: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              />
              {licenseFeedback && (
                <div style={{ fontSize: '10px', color: licenseFeedback.isError ? '#f87171' : '#34d399' }}>
                  {licenseFeedback.text}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setShowLicenseModal(false);
                  setLicenseFeedback(null);
                }}
                style={{
                  padding: '6px 12px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleActivateLicense}
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Activate Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Phase 2 Ergonomics) */}
      {showSettingsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-editor-background, #1e1e1e)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '360px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚙️</span> Assistant & AI Settings
              </div>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setSettingsReason(null);
                  setConnectionFeedback(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-foreground)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                ✕
              </button>
            </div>

            {settingsReason && (
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: '#c7d2fe',
                  lineHeight: '1.4'
                }}
              >
                💡 {settingsReason}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>AI Provider:</label>
              <select
                value={settingsProvider}
                onChange={(e) => {
                  const prov = e.target.value as 'gemini' | 'openai' | 'ollama';
                  setSettingsProvider(prov);
                  setConnectionFeedback(null);
                }}
                style={{
                  padding: '6px',
                  background: 'var(--vscode-dropdown-background)',
                  color: 'var(--vscode-dropdown-foreground)',
                  border: '1px solid var(--vscode-dropdown-border)',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              >
                <option value="gemini">Google Gemini (Recommended — Free Tier)</option>
                <option value="openai">OpenAI (gpt-4o-mini)</option>
                <option value="ollama">Local Ollama (100% Offline)</option>
              </select>
            </div>

            {settingsProvider !== 'ollama' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>
                  {settingsProvider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}:
                </label>
                <input
                  type="password"
                  placeholder={hasConfiguredKey && maskedKey ? `Configured (${maskedKey})` : (settingsProvider === 'gemini' ? 'AIzaSy...' : 'sk-...')}
                  value={settingsApiKey}
                  onChange={(e) => setSettingsApiKey(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}
                />
                {settingsProvider === 'gemini' && (
                  <div style={{ fontSize: '10px', opacity: 0.75, lineHeight: '1.3' }}>
                    ✨ Gemini has a generous free tier with zero card required at <code>aistudio.google.com</code>.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', opacity: 0.85 }}>Ollama Base URL:</label>
                  <input
                    type="text"
                    value={settingsBaseUrl}
                    onChange={(e) => setSettingsBaseUrl(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      background: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '4px',
                      fontSize: '11px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', opacity: 0.85 }}>Ollama Model:</label>
                  <input
                    type="text"
                    value={settingsModel}
                    onChange={(e) => setSettingsModel(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      background: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '4px',
                      fontSize: '11px'
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', opacity: 0.75 }}>
                  🛡️ Runs entirely on your local machine with zero external network requests.
                </div>
              </div>
            )}

            {connectionFeedback && (
              <div
                style={{
                  background: connectionFeedback.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${connectionFeedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: connectionFeedback.success ? '#34d399' : '#fca5a5',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  lineHeight: '1.3'
                }}
              >
                {connectionFeedback.message}
              </div>
            )}

            {settingsToast && (
              <div style={{ color: '#a7f3d0', fontSize: '11px', textAlign: 'center', fontWeight: 600 }}>
                {settingsToast}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                style={{
                  flex: 1,
                  padding: '6px',
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #fff)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isTestingConnection ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                {isTestingConnection ? 'Testing...' : '🔌 Test Connection'}
              </button>
              <button
                onClick={handleSaveSettings}
                style={{
                  flex: 1,
                  padding: '6px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Radar Alert Modal */}
      {secretRadarAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.35)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 700, fontSize: '13px' }}>
              <span>🔒</span> Private API Key Protected
            </div>

            <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: '1.4' }}>
              GitWizard noticed {secretRadarAlert.secrets.length} private credential(s) in your changes. Let's keep them safe so they never leak online:
            </div>

            <div
              style={{
                maxHeight: '140px',
                overflowY: 'auto',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '11px'
              }}
            >
              {secretRadarAlert.secrets.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    <span style={{ fontWeight: 600 }}>{s.file}:{s.line}</span>
                    <span style={{ opacity: 0.7, marginLeft: '4px' }}>({s.ruleName})</span>
                  </div>
                  <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '3px', color: '#fca5a5' }}>
                    {s.maskedSecret}
                  </code>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <button
                onClick={handleRemediateSecrets}
                style={{
                  padding: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '11px',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                }}
              >
                🔒 Protect Key: Move to .env & Add to .gitignore (1-Click)
              </button>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => setSecretRadarAlert(null)}
                  style={{
                    padding: '5px 10px',
                    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                    color: 'var(--vscode-button-secondaryForeground, #fff)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideSecretCommit}
                  style={{
                    padding: '5px 10px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'var(--vscode-foreground)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    opacity: 0.8
                  }}
                >
                  Save Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Production Branch Guard Modal */}
      {branchGuardAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '12px'
          }}
        >
          <div
            style={{
              background: 'var(--vscode-sideBar-background, #1e1e1e)',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '380px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.35)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '13px' }}>
              <span>🛡️</span> Live Website Protection
            </div>

            <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: '1.4' }}>
              You're currently working directly on <code>{status?.branch || 'main'}</code> (your live code). To avoid breaking what users see, GitWizard recommends creating a safe playground branch first.
            </div>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                lineHeight: '1.4'
              }}
            >
              💡 <b>Recommended</b>: Let GitWizard move your changes into a dedicated branch so you can experiment freely.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <button
                onClick={handleRelocateBranch}
                style={{
                  padding: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '11px',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
                }}
              >
                🌿 Save to "{branchGuardAlert.suggestedFeatureBranch}" (Safe)
              </button>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => setBranchGuardAlert(null)}
                  style={{
                    padding: '5px 10px',
                    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                    color: 'var(--vscode-button-secondaryForeground, #fff)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideBranchCommit}
                  style={{
                    padding: '5px 10px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'var(--vscode-foreground)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    opacity: 0.8
                  }}
                >
                  Save to {status?.branch || 'main'} Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pro Badge & Brand Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>🧙</span>
          <span style={{ fontWeight: 700, fontSize: '11px', letterSpacing: '0.6px', color: 'var(--vscode-foreground)' }}>
            GITWIZARD
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => {
              setSettingsReason(null);
              setConnectionFeedback(null);
              vscode.postMessage({ type: 'GET_AI_CONFIG' });
              setShowSettingsModal(true);
            }}
            style={{
              padding: '2px 7px',
              fontSize: '11px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: 'var(--vscode-foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
            title="Assistant & AI Settings"
          >
            ⚙️
          </button>
          {proStatus?.status === 'active_license' ? (
            <span
              onClick={() => setShowLicenseModal(true)}
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(16,185,129,0.3)'
              }}
              title={`Licensed to ${proStatus.email || 'you'}. Click to manage.`}
            >
              ⭐ PRO ACTIVE
            </span>
          ) : proStatus?.status === 'active_trial' ? (
            <span
              onClick={() => setShowLicenseModal(true)}
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="14-Day Free Pro Trial. Click to enter key."
            >
              ✨ PRO TRIAL ({proStatus.trialDaysRemaining ?? 14}d left)
            </span>
          ) : (
            <button
              onClick={() => setShowLicenseModal(true)}
              style={{
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ⚡ UPGRADE PRO ($29)
            </button>
          )}
        </div>
      </div>

      {/* Top Status Card or Uninitialized Hero */}
      {status?.isRepo === false ? (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🪄</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#c7d2fe' }}>
                Turn On GitWizard Safe Mode
              </div>
              <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
                This project is not tracked by Git yet. Enable Safe Mode to turn on automatic time travel and safety backups.
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '11px',
              lineHeight: '1.4',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: 600, color: '#a5b4fc' }}>🛡️ What Safe Mode does for you:</div>
            <div>• <b>Zero lost code</b>: Automatically captures checkpoints before AI edits.</div>
            <div>• <b>1-click undo</b>: Rewind safely when an AI prompt breaks your layout.</div>
            <div>• <b>Secret radar</b>: Shields your API keys from leaking to GitHub.</div>
          </div>

          <button
            onClick={handleInitRepo}
            disabled={isInitializingRepo}
            style={{
              padding: '9px 14px',
              background: isInitializingRepo
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: isInitializingRepo ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 10px rgba(99,102,241,0.35)'
            }}
          >
            {isInitializingRepo ? '⏳ Enabling Safe Mode...' : '✨ Enable Safe Mode (1-Click)'}
          </button>
        </div>
      ) : (
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
      )}

      {/* Active Merge Conflicts Banner */}
      {status?.conflicted && status.conflicted.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.15) 100%)',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#f87171', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚔️</span> {status.conflicted.length} Merge Conflict{status.conflicted.length > 1 ? 's' : ''} Active
            </div>
            <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>PRO AI</span>
          </div>

          <div style={{ fontSize: '11px', opacity: 0.9, lineHeight: '1.4' }}>
            GitWizard can synthesize non-destructive code resolutions for all {status.conflicted.length} conflicted file(s) with 0 lost code.
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleTriggerConflictResolution}
              disabled={isResolvingConflict}
              style={{
                flex: 1,
                padding: '7px 10px',
                background: isResolvingConflict ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '11px',
                cursor: isResolvingConflict ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
              }}
            >
              {isResolvingConflict ? '⏳ AI synthesizing...' : '✨ Auto-Resolve with AI (1-Click)'}
            </button>
            <button
              onClick={handleAbortConflict}
              title="Abort merge/rebase and roll back cleanly"
              style={{
                padding: '7px 10px',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--vscode-foreground)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500
              }}
            >
              ↩️ Abort Merge
            </button>
          </div>
        </div>
      )}

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>
                💾 Save Changes (Commit)
              </div>
              <button
                onClick={handleGenerateAICommit}
                disabled={isGeneratingAI || allDirtyFiles.length === 0}
                style={{
                  fontSize: '10px',
                  padding: '3px 8px',
                  background: isGeneratingAI
                    ? 'rgba(255,255,255,0.1)'
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isGeneratingAI || allDirtyFiles.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(99,102,241,0.25)'
                }}
                title="Generate semantic conventional commit message from working tree diff"
              >
                {isGeneratingAI ? '✨ Analyzing diff...' : '✨ AI Message'}
              </button>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.75, marginBottom: '6px' }}>
              Stage and save your work safely with a message.
            </div>

            {aiError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{aiError}</span>
                <span
                  onClick={() => setAiError(null)}
                  style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '6px' }}
                >
                  ✕
                </span>
              </div>
            )}

            <textarea
              rows={2}
              placeholder="e.g. feat(auth): add OAuth provider & error boundary"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                marginBottom: '6px',
                resize: 'vertical'
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
                cursor: status?.isRepo === false || allDirtyFiles.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              {status?.isRepo === false
                ? '🪄 Enable Safe Mode to Save Changes'
                : allDirtyFiles.length > 0
                ? `💾 Save ${allDirtyFiles.length} Modified File(s)`
                : 'No Changes to Save'}
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

                    <div style={{ display: 'flex', gap: '4px' }}>
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
                        ⏪ All
                      </button>
                      <button
                        onClick={() => handleTriggerFileRewind(snap)}
                        title="Rewind only one specific file from this snapshot"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'var(--vscode-foreground)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        📄 1 File...
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Section: Private GitHub Cloud Sync */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.08) 100%)',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>☁️</span> Private GitHub Cloud Sync
                </div>
                <span style={{ fontSize: '9px', background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>PRO</span>
              </div>
              <div style={{ fontSize: '10px', opacity: 0.8, lineHeight: '1.3' }}>
                Client-side AES-256 encrypted snapshot backup stored on your own repository. Zero third-party servers.
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setShowCloudSyncModal(true)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  ☁️ Sync / Backup to Remote
                </button>
              </div>
            </div>

            {/* Recent Git Reflog Actions */}
            {actions.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8, marginTop: '10px' }}>
                  🕒 Recent Activity:
                </div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {actions.map((act, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '10px',
                        opacity: 0.85,
                        padding: '5px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {act.title}
                      </span>
                      <span style={{ fontSize: '9px', opacity: 0.6, flexShrink: 0 }}>
                        {act.relativeTime || 'Recently'}
                      </span>
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
            AI modified multiple files at once? Divide them cleanly into separate feature branches.
          </p>

          {/* Pro AI Auto-Split Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '6px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#c7d2fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>✨</span> AI Semantic Multi-Branch Auto-Split
              </div>
              <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>PRO</span>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.85, lineHeight: '1.3' }}>
              Automatically cluster {allDirtyFiles.length} modified files into isolated PR branches with semantic commit messages.
            </div>

            <button
              onClick={handleAutoSplitAI}
              disabled={isSplittingAI || allDirtyFiles.length < 2}
              style={{
                padding: '7px 10px',
                background: isSplittingAI ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: isSplittingAI || allDirtyFiles.length < 2 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(99,102,241,0.25)'
              }}
            >
              {isSplittingAI ? '⏳ Analyzing file semantics...' : '✨ Auto-Split into PRs (1-Click)'}
            </button>

            {aiSplitPlan && aiSplitPlan.groups && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#a5b4fc' }}>
                  🎯 AI Proposed {aiSplitPlan.groups.length} Branches:
                </div>
                {aiSplitPlan.groups.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      borderLeft: '2px solid #818cf8'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#e0e7ff' }}>🌿 {g.branch}</div>
                    <div style={{ opacity: 0.8, fontSize: '10px' }}>💬 {g.commitMessage}</div>
                    <div style={{ opacity: 0.6, fontSize: '9px', marginTop: '2px' }}>
                      Files ({g.files.length}): {g.files.join(', ')}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleExecuteAutoSplitPlan}
                  style={{
                    padding: '6px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '11px',
                    marginTop: '2px'
                  }}
                >
                  🚀 Execute AI Multi-Branch Split Now
                </button>
              </div>
            )}
          </div>

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

              {/* Semantic 1-Click Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...selectedForA };
                    allDirtyFiles.forEach(f => {
                      if (getFileCategory(f) === 'ui') next[f] = true;
                    });
                    setSelectedForA(next);
                  }}
                  style={{
                    padding: '3px 7px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    background: 'rgba(236, 72, 153, 0.1)',
                    color: '#f472b6',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  title="Select all frontend UI, styling & template files for Branch A"
                >
                  🎨 All UI ({allDirtyFiles.filter(f => getFileCategory(f) === 'ui').length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...selectedForA };
                    allDirtyFiles.forEach(f => {
                      if (getFileCategory(f) === 'backend') next[f] = true;
                    });
                    setSelectedForA(next);
                  }}
                  style={{
                    padding: '3px 7px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  title="Select all backend, API, routes, and database files for Branch A"
                >
                  ⚙️ All Backend ({allDirtyFiles.filter(f => getFileCategory(f) === 'backend').length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    allDirtyFiles.forEach(f => {
                      next[f] = !selectedForA[f];
                    });
                    setSelectedForA(next);
                  }}
                  style={{
                    padding: '3px 7px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--vscode-foreground)',
                    cursor: 'pointer'
                  }}
                  title="Invert current selection"
                >
                  🔄 Invert
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedForA({})}
                  style={{
                    padding: '3px 7px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--vscode-foreground)',
                    opacity: 0.6,
                    cursor: 'pointer'
                  }}
                  title="Uncheck all files"
                >
                  Clear
                </button>
              </div>

              {/* Visual File Selection Checklist */}
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  Select files to place into Branch A (unselected go to Branch B):
                </div>
                {allDirtyFiles.map((file) => {
                  const cat = getFileCategory(file);
                  const badge = getCategoryBadge(cat);
                  return (
                    <label
                      key={file}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: '3px 4px',
                        borderRadius: '3px',
                        background: selectedForA[file] ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <input
                          type="checkbox"
                          checked={!!selectedForA[file]}
                          onChange={(e) => setSelectedForA({ ...selectedForA, [file]: e.target.checked })}
                        />
                        <span style={{ fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {file}
                        </span>
                      </div>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          fontSize: '9px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                      >
                        {badge.icon} {badge.label}
                      </span>
                    </label>
                  );
                })}
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

          {splitRepoFallbackUrl && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ fontWeight: 600, color: '#93c5fd', fontSize: '11px' }}>
                🌐 GitHub CLI Not Detected
              </div>
              <div style={{ fontSize: '11px', opacity: 0.85, lineHeight: '1.4' }}>
                You can create "{promoteRepoName}" on GitHub in 1 click using your browser, then link its URL below:
              </div>
              <a
                href={splitRepoFallbackUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '6px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '11px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                🌐 Open GitHub in Browser to Create Repo
              </a>
            </div>
          )}

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
