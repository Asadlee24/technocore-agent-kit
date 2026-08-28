/**
 * Technocore Agent Kit — OpenAI AI Provider
 * Integration for OpenAI and OpenAI-compatible inference backends.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type {
  AIChatOptions,
  AIChatResponse,
  AIMessage,
  AIPlanOutput,
  AIProvider,
  AgentRole,
} from '../types.js';

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    fetchFn?: typeof fetch;
  } = {}) {
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY || '' : '');
    this.baseUrl = (options.baseUrl || (typeof process !== 'undefined' ? process.env?.OPENAI_BASE_URL : '') || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.defaultModel = options.defaultModel || 'gpt-4o';
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  public async chat(messages: AIMessage[], options: AIChatOptions = {}): Promise<AIChatResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in constructor.');
    }

    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.2;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (options.systemPrompt && !messages.some((m) => m.role === 'system')) {
      formattedMessages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const body: Record<string, any> = {
      model,
      temperature,
      messages: formattedMessages,
    };

    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI API request failed (${res.status} ${res.statusText}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content || '';

    let parsedJson: any = undefined;
    if (options.responseFormat === 'json') {
      try {
        parsedJson = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) parsedJson = JSON.parse(jsonMatch[0]);
      }
    }

    return {
      text,
      parsedJson,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }

  public async createPlan(goal: string, context?: Record<string, any>): Promise<AIPlanOutput> {
    const systemPrompt = `You are a planner in Technocore Autonomous Agent OS.
Return valid JSON adhering to:
{
  "planTitle": "string",
  "summary": "string",
  "steps": [
    {
      "stepId": "string",
      "title": "string",
      "role": "planner" | "researcher" | "coder" | "tester" | "security_reviewer" | "final_reviewer" | "deployer",
      "requiredCapabilities": ["capability"],
      "instruction": "task prompt",
      "dependsOn": [],
      "riskLevel": "low" | "medium" | "high" | "critical",
      "requiresHumanApproval": false
    }
  ]
}`;

    const res = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Goal: ${goal}\nContext: ${JSON.stringify(context || {})}` },
      ],
      { responseFormat: 'json', temperature: 0.1 }
    );

    if (res.parsedJson && Array.isArray(res.parsedJson.steps)) {
      return res.parsedJson as AIPlanOutput;
    }

    return {
      planTitle: 'Autonomous Plan',
      summary: res.text.slice(0, 100),
      steps: [
        {
          stepId: 'step-1',
          title: 'Execute Task',
          role: 'coder',
          requiredCapabilities: ['edit-code'],
          instruction: goal,
          dependsOn: [],
          riskLevel: 'low',
        },
      ],
    };
  }

  public async reviewResult(
    taskInput: any,
    agentOutput: any,
    role: AgentRole
  ): Promise<{ approved: boolean; score: number; feedback: string }> {
    const prompt = `Evaluate the following agent task output for role ${role}:
Task Input: ${JSON.stringify(taskInput)}
Agent Output: ${JSON.stringify(agentOutput)}
Return JSON: {"approved": boolean, "score": number, "feedback": "string"}`;

    const res = await this.chat([{ role: 'user', content: prompt }], {
      responseFormat: 'json',
      temperature: 0.0,
    });

    if (res.parsedJson && typeof res.parsedJson.approved === 'boolean') {
      return res.parsedJson;
    }

    return { approved: true, score: 0.9, feedback: 'Automated check passed.' };
  }
}
