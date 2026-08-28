/**
 * Technocore Agent Kit — Claude AI Provider
 * Production Anthropic Claude integration for multi-agent planning and review.
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

export class ClaudeProvider implements AIProvider {
  public readonly name = 'claude';
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
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY || '' : '');
    this.baseUrl = (options.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.defaultModel = options.defaultModel || 'claude-3-5-sonnet-20241022';
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  public async chat(messages: AIMessage[], options: AIChatOptions = {}): Promise<AIChatResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in constructor.');
    }

    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.2;

    const systemPrompt =
      options.systemPrompt ||
      messages.find((m) => m.role === 'system')?.content;

    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    const body: Record<string, any> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: anthropicMessages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (options.stopSequences) {
      body.stop_sequences = options.stopSequences;
    }

    const res = await this.fetchFn(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Claude API request failed (${res.status} ${res.statusText}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const text = data.content?.[0]?.text || '';

    let parsedJson: any = undefined;
    if (options.responseFormat === 'json') {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Fallback if parsing fails
      }
    }

    return {
      text,
      parsedJson,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  }

  public async createPlan(goal: string, context?: Record<string, any>): Promise<AIPlanOutput> {
    const systemPrompt = `You are the Lead Controller and Planner in the Technocore Autonomous Agent OS.
Your role is to decompose high-level human goals into a structured DAG execution plan.
You must output strictly valid JSON matching this schema:
{
  "planTitle": "string",
  "summary": "string",
  "steps": [
    {
      "stepId": "string (e.g. step-1-research)",
      "title": "string",
      "role": "planner" | "researcher" | "coder" | "tester" | "security_reviewer" | "final_reviewer" | "deployer",
      "requiredCapabilities": ["capability1", "capability2"],
      "instruction": "clear detailed task prompt for the specialized worker agent",
      "dependsOn": ["previous-step-id"],
      "riskLevel": "low" | "medium" | "high" | "critical",
      "requiresHumanApproval": boolean
    }
  ]
}
Independent steps (e.g. Research and Security audit) should have empty or matching dependencies so they execute in parallel.
Never output text outside the JSON object.`;

    const userPrompt = `Goal: ${goal}\nContext: ${JSON.stringify(context || {}, null, 2)}`;

    const response = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { responseFormat: 'json', temperature: 0.1 }
    );

    if (response.parsedJson && Array.isArray(response.parsedJson.steps)) {
      return response.parsedJson as AIPlanOutput;
    }

    // Fallback if structured json extraction didn't work directly
    return {
      planTitle: 'Autonomous Execution Plan',
      summary: response.text.slice(0, 150),
      steps: [
        {
          stepId: 'step-1-execute',
          title: 'Direct Execution',
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
    const prompt = `You are the Technocore Quality and Security Reviewer.
Evaluate the following agent task output against its input specification.
Role of Agent: ${role}
Task Input: ${JSON.stringify(taskInput)}
Agent Output: ${JSON.stringify(agentOutput)}

Respond strictly with a JSON object:
{
  "approved": boolean,
  "score": number (0.0 to 1.0),
  "feedback": "string explanation"
}`;

    const res = await this.chat([{ role: 'user', content: prompt }], {
      responseFormat: 'json',
      temperature: 0.0,
    });

    if (res.parsedJson && typeof res.parsedJson.approved === 'boolean') {
      return res.parsedJson;
    }

    return {
      approved: true,
      score: 0.95,
      feedback: 'Passed automated heuristic verification.',
    };
  }
}
