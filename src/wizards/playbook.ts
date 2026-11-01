/**
 * GitWizard: Vibe Coder Playbook
 * Step-by-step "What to do & When" interactive recipes and micro-guidance.
 * Translates complex Git workflows into zero-jargon, vibe-first actions.
 */

export type PlaybookCategory = 'all' | 'setup' | 'daily' | 'undo' | 'split' | 'cloud';

export interface PlaybookRecipe {
  id: string;
  category: PlaybookCategory;
  categoryLabel: string;
  icon: string;
  title: string;
  when: string;
  whatToDo: string[];
  whyItKeepsYouSafe: string;
  targetTab: 'daily' | 'timeline' | 'split' | 'promote';
  actionButtonText: string;
}

export const PLAYBOOK_RECIPES: PlaybookRecipe[] = [
  {
    id: 'init-project',
    category: 'setup',
    categoryLabel: '🚀 Setup',
    icon: '🏁',
    title: 'Starting a New Project / Fresh Folder',
    when: 'You just opened an empty folder or brand new project not yet tracked by Git.',
    whatToDo: [
      'Go to the ⚡ Everyday tab.',
      'Click "✨ Enable Safe Mode (1-Click)".'
    ],
    whyItKeepsYouSafe: 'Instantly turns on passive flight recording and automatic checkpoints before any AI writes or changes code.',
    targetTab: 'daily',
    actionButtonText: '✨ Enable Safe Mode'
  },
  {
    id: 'save-milestone',
    category: 'daily',
    categoryLabel: '💾 Daily Flow',
    icon: '💾',
    title: 'AI Just Generated Working Code',
    when: 'Your AI prompt produced code that works and you want to lock it in.',
    whatToDo: [
      'Click [✨ AI Message] to automatically draft a clear, conventional summary.',
      'Click [💾 Save My Work] to lock in your progress.'
    ],
    whyItKeepsYouSafe: 'Creates a permanent milestone in 1 second. If future prompts go off the rails, you can return here instantly.',
    targetTab: 'daily',
    actionButtonText: '💾 Open Everyday Saver'
  },
  {
    id: 'rewind-hallucination',
    category: 'undo',
    categoryLabel: '🚨 Fix Bugs & Undo',
    icon: '⏳',
    title: 'AI Hallucinated or Broke Your App',
    when: 'Code fails to compile, red terminal errors appear, or unwanted AI edits broke your layout.',
    whatToDo: [
      'Switch to the ⏳ Rewind tab.',
      'Click [↺ Undo Live Edits] for uncommitted mistakes, or pick an earlier saved version and click [↺ Restore This Version].'
    ],
    whyItKeepsYouSafe: 'GitWizard always captures a fresh checkpoint before rewinding, guaranteeing zero data loss.',
    targetTab: 'timeline',
    actionButtonText: '⏳ Open Time Travel'
  },
  {
    id: 'split-tangled-code',
    category: 'split',
    categoryLabel: '✂️ Organization',
    icon: '✂️',
    title: 'AI Touched 15+ Files Across UI and Backend',
    when: 'A single prompt edited styles, database schemas, and API routes all at once.',
    whatToDo: [
      'Switch to the ✂️ Split tab.',
      'Click [🎨 All UI] or [⚙️ All Backend] to group files automatically.',
      'Click [✂️ Split Work Safely] to divide them into two clean branches.'
    ],
    whyItKeepsYouSafe: 'Turns a messy code dump into organized, reviewable branches with full safety rollback protection.',
    targetTab: 'split',
    actionButtonText: '✂️ Open Smart Splitter'
  },
  {
    id: 'cloud-backup',
    category: 'cloud',
    categoryLabel: '☁️ Cloud Backup',
    icon: '☁️',
    title: 'Backing Up to GitHub (Cloud Protection)',
    when: 'You finished coding for the day, or want offsite protection against laptop loss.',
    whatToDo: [
      'Go to the ⚡ Everyday tab.',
      'Click [⬆️ Send (Push)]. If not connected yet, GitWizard opens the 1-click Cloud Assistant.'
    ],
    whyItKeepsYouSafe: 'Your code is securely synced to your private GitHub repo with zero terminal or SSH configuration.',
    targetTab: 'daily',
    actionButtonText: '☁️ Open Cloud Backup'
  },
  {
    id: 'sync-conflicts',
    category: 'daily',
    categoryLabel: '🤝 Collaboration',
    icon: '⚔️',
    title: 'Getting Teammate Updates / Resolving Conflicts',
    when: 'Pulling updates produces conflicting edits (<<<<<<< HEAD) or team changes.',
    whatToDo: [
      'Click [⬇️ Update (Safe Pull)].',
      'If conflicts arise, click [✨ Auto-Resolve with AI (1-Click)] or [↩️ Abort Merge].'
    ],
    whyItKeepsYouSafe: 'If conflicts happen, GitWizard immediately restores your clean workspace or synthesizes a unified non-destructive resolution.',
    targetTab: 'daily',
    actionButtonText: '⬇️ Go to Safe Update'
  }
];

export const PLAYBOOK_GOLDEN_RULES = [
  {
    icon: '⚡',
    title: 'Prompt & Checkpoint',
    desc: 'Prompt your AI → verify in your app → click 💾 Save My Work immediately when it works.'
  },
  {
    icon: '↺',
    title: 'Rewind Before Retrying',
    desc: 'If an AI hallucinates or breaks your code, hit ⏳ Rewind back to green rather than asking the AI to fix a broken fix.'
  },
  {
    icon: '☁️',
    title: 'Daily Cloud Backup',
    desc: 'Click ⬆️ Send at the end of each session so your work is safely protected in the cloud.'
  }
];

export const TAB_MICRO_GUIDANCE: Record<string, string> = {
  daily: '💡 When to use: Save checkpoints after every working AI prompt, or push cloud backups to GitHub.',
  timeline: '💡 When to use: Rewind here anytime an AI agent hallucinates, creates bugs, or breaks your screen.',
  split: '💡 When to use: Separate a massive multi-file AI prompt into tidy, bite-sized feature branches.',
  promote: '💡 When to use: Turn your local project or branch into a standalone GitHub repository in 1 click.'
};

export function getPlaybookRecipes(filter: PlaybookCategory = 'all'): PlaybookRecipe[] {
  if (filter === 'all') {
    return PLAYBOOK_RECIPES;
  }
  return PLAYBOOK_RECIPES.filter(r => r.category === filter);
}

export function getRecipeById(id: string): PlaybookRecipe | undefined {
  return PLAYBOOK_RECIPES.find(r => r.id === id);
}

