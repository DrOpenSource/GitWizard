/**
 * File Category & Semantic Classification Utility
 * Helps vibe coders intuitively understand and filter files by role
 * (UI / Components, API / Backend, Config / Environment, Documentation).
 */

export type FileCategory = 'ui' | 'backend' | 'config' | 'doc';

export interface CategoryBadgeInfo {
  category: FileCategory;
  label: string;
  icon: string;
  bg: string;
  color: string;
}

const UI_EXTENSIONS = new Set([
  'css', 'scss', 'sass', 'less', 'styl',
  'tsx', 'jsx', 'vue', 'svelte', 'html', 'htm'
]);

const BACKEND_EXTENSIONS = new Set([
  'prisma', 'sql', 'py', 'go', 'rs', 'java', 'php', 'rb', 'cpp', 'c', 'cs', 'graphql', 'gql'
]);

const DOC_EXTENSIONS = new Set([
  'md', 'mdx', 'markdown', 'txt', 'rst', 'pdf', 'doc', 'docx'
]);

/**
 * Categorize a file path into an intuitive creator role.
 */
export function getFileCategory(filePath: string): FileCategory {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const filename = normalized.split('/').pop() || '';
  const ext = filename.includes('.') ? filename.split('.').pop() || '' : '';

  // Explicit UI path markers
  if (UI_EXTENSIONS.has(ext)) {
    return 'ui';
  }
  if (
    normalized.includes('/components/') ||
    normalized.includes('/views/') ||
    normalized.includes('/styles/') ||
    normalized.includes('/pages/') ||
    normalized.includes('/ui/')
  ) {
    if (['ts', 'js'].includes(ext)) {
      return 'ui';
    }
  }

  // Explicit Backend / Logic / DB markers
  if (BACKEND_EXTENSIONS.has(ext)) {
    return 'backend';
  }
  if (['ts', 'js', 'mjs', 'cjs'].includes(ext)) {
    if (
      normalized.includes('/api/') ||
      normalized.includes('/routes/') ||
      normalized.includes('/controllers/') ||
      normalized.includes('/services/') ||
      normalized.includes('/models/') ||
      normalized.includes('/backend/') ||
      normalized.includes('/server/') ||
      normalized.includes('.test.') ||
      normalized.includes('.spec.')
    ) {
      return 'backend';
    }
    // Default TypeScript / JavaScript files without UI markers are backend / logic
    return 'backend';
  }

  // Documentation
  if (DOC_EXTENSIONS.has(ext)) {
    return 'doc';
  }

  // Config / Assets / Misc (JSON, YAML, ENV, lockfiles, SVG, PNG, etc.)
  return 'config';
}

/**
 * Returns user-facing badge presentation for a category.
 */
export function getCategoryBadge(category: FileCategory): CategoryBadgeInfo {
  switch (category) {
    case 'ui':
      return {
        category: 'ui',
        label: 'UI',
        icon: '🎨',
        bg: 'rgba(236, 72, 153, 0.15)',
        color: '#f472b6'
      };
    case 'backend':
      return {
        category: 'backend',
        label: 'API/Backend',
        icon: '⚙️',
        bg: 'rgba(59, 130, 246, 0.15)',
        color: '#93c5fd'
      };
    case 'doc':
      return {
        category: 'doc',
        label: 'Docs',
        icon: '📝',
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#6ee7b7'
      };
    case 'config':
    default:
      return {
        category: 'config',
        label: 'Config',
        icon: '📄',
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#fcd34d'
      };
  }
}

