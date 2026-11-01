import { describe, it, expect } from 'vitest';
import {
  PLAYBOOK_RECIPES,
  PLAYBOOK_GOLDEN_RULES,
  TAB_MICRO_GUIDANCE,
  getPlaybookRecipes,
  getRecipeById
} from '../../src/wizards/playbook';

describe('Vibe Coder Playbook: What to do & When', () => {
  it('contains exactly 6 core visual scenario recipes covering lifecycle from setup to sync', () => {
    expect(PLAYBOOK_RECIPES).toHaveLength(6);
    const ids = PLAYBOOK_RECIPES.map(r => r.id);
    expect(ids).toEqual([
      'init-project',
      'save-milestone',
      'rewind-hallucination',
      'split-tangled-code',
      'cloud-backup',
      'sync-conflicts'
    ]);
  });

  it('filters recipes by category correctly', () => {
    const all = getPlaybookRecipes('all');
    expect(all).toHaveLength(6);

    const setup = getPlaybookRecipes('setup');
    expect(setup).toHaveLength(1);
    expect(setup[0].id).toBe('init-project');

    const undo = getPlaybookRecipes('undo');
    expect(undo).toHaveLength(1);
    expect(undo[0].id).toBe('rewind-hallucination');

    const split = getPlaybookRecipes('split');
    expect(split).toHaveLength(1);
    expect(split[0].id).toBe('split-tangled-code');

    const cloud = getPlaybookRecipes('cloud');
    expect(cloud).toHaveLength(1);
    expect(cloud[0].id).toBe('cloud-backup');
  });

  it('retrieves individual recipes by ID', () => {
    const recipe = getRecipeById('save-milestone');
    expect(recipe).toBeDefined();
    expect(recipe?.title).toBe('AI Just Generated Working Code');
    expect(recipe?.targetTab).toBe('daily');
    expect(recipe?.actionButtonText).toBe('💾 Open Everyday Saver');

    const nonExistent = getRecipeById('non-existent');
    expect(nonExistent).toBeUndefined();
  });

  it('enforces Zero-Jargon policy across all recipe texts', () => {
    // Prohibited git plumbing jargon in user-facing texts
    const prohibitedJargon = [
      /\bDAG\b/i,
      /\breflog\b/i,
      /\bHEAD@\{/i,
      /\bindex staging\b/i,
      /\bfatal: origin\b/i,
      /\bdetached HEAD\b/i
    ];

    PLAYBOOK_RECIPES.forEach(recipe => {
      const combinedText = [
        recipe.title,
        recipe.when,
        ...recipe.whatToDo,
        recipe.whyItKeepsYouSafe
      ].join(' ');

      prohibitedJargon.forEach(pattern => {
        expect(pattern.test(combinedText)).toBe(false);
      });
    });
  });

  it('provides embedded micro-coaching chips for all core tabs', () => {
    expect(TAB_MICRO_GUIDANCE.daily).toContain('💡 When to use:');
    expect(TAB_MICRO_GUIDANCE.timeline).toContain('💡 When to use:');
    expect(TAB_MICRO_GUIDANCE.split).toContain('💡 When to use:');
    expect(TAB_MICRO_GUIDANCE.promote).toContain('💡 When to use:');
  });

  it('provides the 3 Vibe Coder Golden Rules', () => {
    expect(PLAYBOOK_GOLDEN_RULES).toHaveLength(3);
    const titles = PLAYBOOK_GOLDEN_RULES.map(r => r.title);
    expect(titles).toContain('Prompt & Checkpoint');
    expect(titles).toContain('Rewind Before Retrying');
    expect(titles).toContain('Daily Cloud Backup');
  });
});

