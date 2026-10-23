/**
 * GitWizard Pro: Pre-Flight Secret Radar
 * Ultra-fast (<100ms) detection of leaked API keys, tokens, and high-entropy credentials
 * in working tree diffs and untracked files before committing.
 */

export interface DetectedSecret {
  ruleId: string;
  ruleName: string;
  file: string;
  line: number;
  rawSecret: string;
  maskedSecret: string;
  entropy?: number;
}

export interface SecretScanResult {
  hasSecrets: boolean;
  totalFound: number;
  secrets: DetectedSecret[];
  scanDurationMs: number;
}

export interface SecretScannerOptions {
  allowTestKeys?: boolean; // If true, ignore sk_test_... Stripe keys
  entropyThreshold?: number; // Minimum Shannon entropy score (default: 4.5)
}

interface SecretPattern {
  id: string;
  name: string;
  regex: RegExp;
  isTestKey?: boolean;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // OpenAI
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    regex: /\b(sk-(?:proj|admin)-[a-zA-Z0-9_\-]{20,}|sk-[a-zA-Z0-9]{32,48})\b/g
  },
  // Anthropic
  {
    id: 'anthropic-api-key',
    name: 'Anthropic Claude API Key',
    regex: /\b(sk-ant-[a-zA-Z0-9_\-]{20,})\b/g
  },
  // Google Gemini / API Key
  {
    id: 'google-api-key',
    name: 'Google Gemini / Cloud API Key',
    regex: /\b(AIzaSy[a-zA-Z0-9_\-]{33})\b/g
  },
  // Stripe Live Keys
  {
    id: 'stripe-live-secret',
    name: 'Stripe Live Secret Key',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,})\b/g
  },
  {
    id: 'stripe-live-restricted',
    name: 'Stripe Live Restricted Key',
    regex: /\b(rk_live_[0-9a-zA-Z]{24,})\b/g
  },
  // Stripe Test Keys (marked for optional filter)
  {
    id: 'stripe-test-key',
    name: 'Stripe Test Key',
    regex: /\b([sr]k_test_[0-9a-zA-Z]{24,})\b/g,
    isTestKey: true
  },
  // AWS Access Key ID
  {
    id: 'aws-access-key-id',
    name: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g
  },
  // GitHub Tokens
  {
    id: 'github-pat',
    name: 'GitHub Personal Access Token',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|gho_[a-zA-Z0-9]{36})\b/g
  },
  // Slack Token
  {
    id: 'slack-token',
    name: 'Slack API Token',
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g
  },
  // Database Connection URL with credentials
  {
    id: 'database-url-credentials',
    name: 'Database URL with Password',
    regex: /\b((?:postgres|postgresql|mongodb|mysql|redis):\/\/[a-zA-Z0-9_.\-]+:([^@\s]+)@[a-zA-Z0-9_.\-]+(?::[0-9]+)?(?:\/[^\s"']*)?)\b/g
  },
  // Private Key Headers
  {
    id: 'private-key-pem',
    name: 'Private Key (PEM)',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g
  }
];

// UUID regex to suppress false positives from entropy check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Git Commit SHA (40 or 64 hex characters) to suppress false positives
const HEX_HASH_REGEX = /^[0-9a-f]{32,64}$/i;

export class SecretScanner {
  private options: SecretScannerOptions;

  constructor(options: SecretScannerOptions = {}) {
    this.options = {
      allowTestKeys: options.allowTestKeys ?? false,
      entropyThreshold: options.entropyThreshold ?? 4.5
    };
  }

  /**
   * Calculates Shannon Entropy of a string.
   * Typical random secrets (base64, hex) have H > 4.2-4.5.
   */
  static calculateShannonEntropy(str: string): number {
    if (!str || str.length === 0) return 0;
    const len = str.length;
    const frequencies = new Map<string, number>();

    for (const char of str) {
      frequencies.set(char, (frequencies.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of frequencies.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Masks a sensitive string for display (e.g. sk-proj-...aBcD)
   */
  static maskSecret(secret: string): string {
    if (!secret || secret.length <= 8) {
      return '********';
    }
    const prefix = secret.slice(0, 4);
    const suffix = secret.slice(-4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Scans a multiline text file or git diff content for secrets.
   */
  scanContent(content: string, filename: string = 'diff'): SecretScanResult {
    const startTime = performance.now();
    const secrets: DetectedSecret[] = [];
    const seenSecrets = new Set<string>();

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      const lineKnownSecrets = new Set<string>();

      // 1. Catalog pattern checks
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.isTestKey && this.options.allowTestKeys) {
          continue;
        }

        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.regex.exec(line)) !== null) {
          const raw = match[1] || match[0];
          const dedupeKey = `${filename}:${lineNumber}:${pattern.id}:${raw}`;

          if (!seenSecrets.has(dedupeKey)) {
            seenSecrets.add(dedupeKey);
            lineKnownSecrets.add(raw);
            secrets.push({
              ruleId: pattern.id,
              ruleName: pattern.name,
              file: filename,
              line: lineNumber,
              rawSecret: raw,
              maskedSecret: SecretScanner.maskSecret(raw)
            });
          }
        }
      }

      // 2. High-Entropy Scanner for un-prefixed secrets
      this.scanLineForEntropy(line, lineNumber, filename, secrets, seenSecrets, lineKnownSecrets);
    }

    const duration = performance.now() - startTime;

    return {
      hasSecrets: secrets.length > 0,
      totalFound: secrets.length,
      secrets,
      scanDurationMs: Math.round(duration * 100) / 100
    };
  }

  /**
   * Scans a single line for high-entropy tokens (e.g. generic base64/hex secrets).
   */
  private scanLineForEntropy(
    line: string,
    lineNumber: number,
    filename: string,
    secrets: DetectedSecret[],
    seenSecrets: Set<string>,
    lineKnownSecrets: Set<string>
  ): void {
    // Look for string literals or assignments: e.g. key = "xyz..." or secret: 'xyz...'
    const tokenRegex = /['"]([a-zA-Z0-9_\-+/=]{24,80})['"]/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(line)) !== null) {
      const token = match[1];

      // If already matched by a specific named rule on this line, skip
      if (lineKnownSecrets.has(token) || Array.from(lineKnownSecrets).some(k => token.includes(k) || k.includes(token))) {
        continue;
      }

      // Suppress UUIDs and git SHA / hash falses
      if (UUID_REGEX.test(token) || HEX_HASH_REGEX.test(token)) {
        continue;
      }

      // Suppress camelCase / english word combinations without digits/symbols
      if (/^[a-zA-Z]+$/.test(token) && !/[0-9]/.test(token)) {
        continue;
      }

      const entropy = SecretScanner.calculateShannonEntropy(token);

      if (entropy >= (this.options.entropyThreshold || 4.5)) {
        const dedupeKey = `${filename}:${lineNumber}:high-entropy-token:${token}`;
        if (!seenSecrets.has(dedupeKey)) {
          seenSecrets.add(dedupeKey);
          secrets.push({
            ruleId: 'high-entropy-token',
            ruleName: 'High-Entropy Generic Secret',
            file: filename,
            line: lineNumber,
            rawSecret: token,
            maskedSecret: SecretScanner.maskSecret(token),
            entropy: Math.round(entropy * 100) / 100
          });
        }
      }
    }
  }
}
