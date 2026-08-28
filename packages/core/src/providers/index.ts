/**
 * Technocore Agent Kit — AI Providers Index
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

export * from './claude.js';
export * from './openai.js';
export * from './local.js';

import type { AIProvider } from '../types.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { LocalProvider } from './local.js';

export function createAIProvider(
  type: 'claude' | 'openai' | 'local' | 'auto' = 'auto',
  options: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  } = {}
): AIProvider {
  if (type === 'claude') {
    return new ClaudeProvider({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      defaultModel: options.model,
    });
  }

  if (type === 'openai') {
    return new OpenAIProvider({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      defaultModel: options.model,
    });
  }

  if (type === 'local') {
    return new LocalProvider();
  }

  // Auto-detection based on environment variables
  if (typeof process !== 'undefined') {
    if (process.env?.ANTHROPIC_API_KEY) {
      return new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    if (process.env?.OPENAI_API_KEY) {
      return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  return new LocalProvider();
}
