import { describe, it, expect, vi } from 'vitest';
import { AIService } from '../../src/pro/ai-service';

describe('AIService (Chunk 7.2 Provider-Agnostic AI Integration)', () => {
  it('diff-pruning: strips massive lockfiles and truncates oversized diffs', () => {
    const rawDiff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-console.log("old");
+console.log("new");
diff --git a/package-lock.json b/package-lock.json
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5000 +1,5000 @@
+ {"lots": "of lockfile noise"}
diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1 +1 @@
+export const x = 42;`;

    const pruned = AIService.pruneDiff(rawDiff, 2000);
    expect(pruned).toContain('src/app.ts');
    expect(pruned).toContain('src/utils.ts');
    expect(pruned).toContain('omitted lockfile: a/package-lock.json');
    expect(pruned).not.toContain('lots of lockfile noise');
  });

  it('missing-api-key: returns clear, friendly error when key is not provided', async () => {
    const ai = new AIService({ provider: 'gemini', apiKey: '' });
    const res = await ai.generateCompletion('Generate commit');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Missing API key for GEMINI');
  });

  it('gemini-provider: successfully formats request and parses Gemini response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'feat(auth): add login modal component' }]
            }
          }
        ]
      })
    });

    const ai = new AIService({ provider: 'gemini', apiKey: 'fake-gemini-key' });
    const res = await ai.generateCompletion('summarize diff', {
      fetchFn: mockFetch as any,
      systemPrompt: 'You are a Git commit expert'
    });

    expect(res.success).toBe(true);
    expect(res.content).toBe('feat(auth): add login modal component');
    expect(res.provider).toBe('gemini');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('key=fake-gemini-key');
  });

  it('openai-provider: successfully formats request and parses OpenAI response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: 'fix(api): handle timeout error gracefully' }
          }
        ]
      })
    });

    const ai = new AIService({ provider: 'openai', apiKey: 'fake-openai-key' });
    const res = await ai.generateCompletion('summarize diff', {
      fetchFn: mockFetch as any
    });

    expect(res.success).toBe(true);
    expect(res.content).toBe('fix(api): handle timeout error gracefully');
    expect(res.provider).toBe('openai');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer fake-openai-key');
  });

  it('ollama-local: calls local endpoint without requiring API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'refactor(store): simplify state machine'
      })
    });

    const ai = new AIService({ provider: 'ollama' });
    const res = await ai.generateCompletion('summarize diff', {
      fetchFn: mockFetch as any
    });

    expect(res.success).toBe(true);
    expect(res.content).toBe('refactor(store): simplify state machine');
    expect(res.provider).toBe('ollama');
  });

  it('rate-limit-429: handles 429 rate limit with informative message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    });

    const ai = new AIService({ provider: 'gemini', apiKey: 'fake-key' });
    const res = await ai.generateCompletion('summarize', {
      fetchFn: mockFetch as any
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('rate limit reached (429)');
  });
});
