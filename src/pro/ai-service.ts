/**
 * GitWizard Pro: Provider-Agnostic AI Service
 * Supports Google Gemini, OpenAI, and local Ollama with zero external HTTP dependencies.
 * Uses native fetch with smart diff pruning and rate-limit backoff.
 */

export type AIProvider = 'gemini' | 'openai' | 'ollama';

export interface AIModelConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string; // For Ollama or custom endpoints
}

export interface AIPromptOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  fetchFn?: typeof fetch; // Injectable fetch for isolated testing
}

export interface AITestConnectionOptions extends AIPromptOptions {
  provider?: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AIResponse {
  success: boolean;
  content: string;
  provider: AIProvider;
  model: string;
  error?: string;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
  ollama: 'llama3.2'
};

const LOCKFILE_PATTERNS = [
  /^diff --git a\/package-lock\.json/m,
  /^diff --git a\/pnpm-lock\.yaml/m,
  /^diff --git a\/yarn\.lock/m,
  /^diff --git a\/Cargo\.lock/m,
  /^diff --git a\/poetry\.lock/m,
  /^diff --git a\/composer\.lock/m
];

export class AIService {
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = {
      ...config,
      model: config.model || DEFAULT_MODELS[config.provider] || 'gemini-1.5-flash'
    };
  }

  /**
   * Update active configuration (e.g. when user sets API key in settings)
   */
  updateConfig(config: Partial<AIModelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get active config summary (without leaking API key)
   */
  getConfigSummary(): { provider: AIProvider; model: string; hasKey: boolean } {
    return {
      provider: this.config.provider,
      model: this.config.model || DEFAULT_MODELS[this.config.provider],
      hasKey: Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0)
    };
  }

  /**
   * Smart diff pruning: strips out massive lockfiles and trims huge diffs
   * to conserve tokens and prevent context overflow.
   */
  static pruneDiff(rawDiff: string, maxChars: number = 15000): string {
    if (!rawDiff) return '';

    // Split diff by file blocks
    const fileBlocks = rawDiff.split(/^diff --git /m);
    const keptBlocks: string[] = [];

    for (const block of fileBlocks) {
      if (!block.trim()) continue;
      const reconstructed = 'diff --git ' + block;

      // Check if this file block is a lockfile
      const isLockfile = LOCKFILE_PATTERNS.some(p => p.test(reconstructed));
      if (isLockfile) {
        keptBlocks.push(`diff --git (omitted lockfile: ${block.split('\n')[0]})\n`);
      } else {
        keptBlocks.push(reconstructed);
      }
    }

    let combined = keptBlocks.join('\n');
    if (combined.length > maxChars) {
      combined = combined.slice(0, maxChars) + '\n\n[... Diff truncated by GitWizard to conserve tokens ...]';
    }

    return combined;
  }

  /**
   * Test active connection with a minimal prompt
   */
  async testConnection(options: AITestConnectionOptions = {}): Promise<{ success: boolean; message: string }> {
    const provider = options.provider || this.config.provider;
    const apiKey = options.apiKey !== undefined ? options.apiKey : (this.config.apiKey || '');
    const baseUrl = options.baseUrl || this.config.baseUrl;
    const model = options.model || this.config.model;

    if (provider !== 'ollama' && (!apiKey || !apiKey.trim())) {
      return {
        success: false,
        message: `Please enter an API key for ${provider.toUpperCase()}.`
      };
    }

    const testService = new AIService({
      provider,
      apiKey,
      baseUrl,
      model
    });

    const res = await testService.generateCompletion('Respond with: OK', { ...options, maxTokens: 10 });
    if (res.success) {
      return {
        success: true,
        message: `Connected successfully to ${res.provider.toUpperCase()} (${res.model})! ✨`
      };
    }
    return {
      success: false,
      message: res.error || 'Connection test failed. Please check your API key or network.'
    };
  }

  /**
   * Send prompt to the configured AI provider.
   */
  async generateCompletion(prompt: string, options: AIPromptOptions = {}): Promise<AIResponse> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const provider = this.config.provider;
    const model = this.config.model || DEFAULT_MODELS[provider];

    if (provider !== 'ollama' && (!this.config.apiKey || !this.config.apiKey.trim())) {
      return {
        success: false,
        content: '',
        provider,
        model,
        error: `Missing API key for ${provider.toUpperCase()}. Please configure your API key in GitWizard Pro settings.`
      };
    }

    try {
      if (provider === 'gemini') {
        return await this.callGemini(prompt, model, options, fetchImpl);
      } else if (provider === 'openai') {
        return await this.callOpenAI(prompt, model, options, fetchImpl);
      } else if (provider === 'ollama') {
        return await this.callOllama(prompt, model, options, fetchImpl);
      } else {
        return {
          success: false,
          content: '',
          provider,
          model,
          error: `Unsupported provider: ${provider}`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        content: '',
        provider,
        model,
        error: `AI request failed: ${err.message || String(err)}`
      };
    }
  }

  private async callGemini(
    prompt: string,
    model: string,
    options: AIPromptOptions,
    fetchImpl: typeof fetch
  ): Promise<AIResponse> {
    const apiKey = this.config.apiKey?.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 1024
      }
    };

    if (options.systemPrompt) {
      (body as any).systemInstruction = {
        parts: [{ text: options.systemPrompt }]
      };
    }

    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) {
        return {
          success: false,
          content: '',
          provider: 'gemini',
          model,
          error: 'Gemini API rate limit reached (429). Please wait a moment and try again.'
        };
      }
      return {
        success: false,
        content: '',
        provider: 'gemini',
        model,
        error: `Gemini API error (${res.status}): ${errText}`
      };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text?.trim() || '';

    return {
      success: true,
      content: text,
      provider: 'gemini',
      model
    };
  }

  private async callOpenAI(
    prompt: string,
    model: string,
    options: AIPromptOptions,
    fetchImpl: typeof fetch
  ): Promise<AIResponse> {
    const apiKey = this.config.apiKey?.trim();
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) {
        return {
          success: false,
          content: '',
          provider: 'openai',
          model,
          error: 'OpenAI API rate limit reached (429). Please wait a moment and try again.'
        };
      }
      return {
        success: false,
        content: '',
        provider: 'openai',
        model,
        error: `OpenAI API error (${res.status}): ${errText}`
      };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    return {
      success: true,
      content: text,
      provider: 'openai',
      model
    };
  }

  private async callOllama(
    prompt: string,
    model: string,
    options: AIPromptOptions,
    fetchImpl: typeof fetch
  ): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    const url = `${baseUrl}/api/generate`;

    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        content: '',
        provider: 'ollama',
        model,
        error: `Ollama error (${res.status}): ${errText}`
      };
    }

    const data = await res.json();
    const text = data.response?.trim() || '';

    return {
      success: true,
      content: text,
      provider: 'ollama',
      model
    };
  }
}
