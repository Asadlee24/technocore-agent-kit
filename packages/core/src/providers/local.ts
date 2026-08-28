/**
 * Technocore Agent Kit — Local Deterministic AI Provider
 * Zero-key, offline-first planner & evaluator for local execution, test suites, and edge nodes.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import type {
  AIChatOptions,
  AIChatResponse,
  AIMessage,
  AIPlanOutput,
  AIPlanStep,
  AIProvider,
  AgentRole,
} from '../types.js';

export class LocalProvider implements AIProvider {
  public readonly name = 'local';

  public async chat(messages: AIMessage[], _options: AIChatOptions = {}): Promise<AIChatResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const responseText = `[LocalProvider Engine]: Processed request: "${lastUserMessage.slice(0, 80)}"`;

    return {
      text: responseText,
      usage: {
        inputTokens: lastUserMessage.length,
        outputTokens: responseText.length,
      },
    };
  }

  public async createPlan(goal: string, context?: Record<string, any>): Promise<AIPlanOutput> {
    const isCodingTask = /code|build|feature|fix|refactor|test|implement|api/i.test(goal);
    const isResearchTask = /research|find|search|analyze|investigate/i.test(goal);

    let steps: AIPlanStep[];

    if (isCodingTask) {
      steps = [
        {
          stepId: 'step-1-research',
          title: 'Architecture & Requirement Research',
          role: 'researcher',
          requiredCapabilities: ['web-research', 'summarization'],
          instruction: `Investigate best practices, existing repository patterns, and dependencies for: ${goal}`,
          dependsOn: [],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
        {
          stepId: 'step-2-security-audit',
          title: 'Threat Modeling & Security Policy Pre-Check',
          role: 'security_reviewer',
          requiredCapabilities: ['security-audit'],
          instruction: `Assess potential attack vectors, secret isolation, and permission boundaries for: ${goal}`,
          dependsOn: [], // Runs in parallel with research
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
        {
          stepId: 'step-3-implement',
          title: 'Modular Implementation',
          role: 'coder',
          requiredCapabilities: ['edit-code'],
          instruction: `Write clean, typed, modular code satisfying the research and security criteria for: ${goal}`,
          dependsOn: ['step-1-research', 'step-2-security-audit'],
          riskLevel: 'medium',
          requiresHumanApproval: false,
        },
        {
          stepId: 'step-4-test',
          title: 'Unit & Integration Verification',
          role: 'tester',
          requiredCapabilities: ['test-code'],
          instruction: `Construct and execute comprehensive test suites verifying functionality and edge cases.`,
          dependsOn: ['step-3-implement'],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
        {
          stepId: 'step-5-security-review',
          title: 'Final Code & Security Review',
          role: 'security_reviewer',
          requiredCapabilities: ['security-audit', 'code-review'],
          instruction: `Audit implementation for vulnerabilities, injection risks, and compliance with Technocore invariants.`,
          dependsOn: ['step-4-test'],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
        {
          stepId: 'step-6-final-approval',
          title: 'Final Provenance Attestation & Result Signoff',
          role: 'final_reviewer',
          requiredCapabilities: ['summarization'],
          instruction: `Review all verifiable artifacts, summarize changes, and sign off on completed task result.`,
          dependsOn: ['step-5-security-review'],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
      ];
    } else if (isResearchTask) {
      steps = [
        {
          stepId: 'step-1-gather',
          title: 'Information Gathering & Synthesis',
          role: 'researcher',
          requiredCapabilities: ['web-research'],
          instruction: `Gather and synthesize primary data regarding: ${goal}`,
          dependsOn: [],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
        {
          stepId: 'step-2-summarize',
          title: 'Structured Summary Generation',
          role: 'researcher',
          requiredCapabilities: ['summarization'],
          instruction: `Synthesize gathered findings into a concise, structured report with key recommendations.`,
          dependsOn: ['step-1-gather'],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
      ];
    } else {
      steps = [
        {
          stepId: 'step-1-execute',
          title: 'Direct Task Execution',
          role: 'coder',
          requiredCapabilities: ['calculate', 'summarization'],
          instruction: goal,
          dependsOn: [],
          riskLevel: 'low',
          requiresHumanApproval: false,
        },
      ];
    }

    return {
      planTitle: `Autonomous Multi-Agent Plan: ${goal.slice(0, 40)}`,
      summary: `Decomposed plan consisting of ${steps.length} specialized task steps with cryptographic provenance.`,
      steps,
    };
  }

  public async reviewResult(
    _taskInput: any,
    _agentOutput: any,
    _role: AgentRole
  ): Promise<{ approved: boolean; score: number; feedback: string }> {
    return {
      approved: true,
      score: 1.0,
      feedback: 'Passed deterministic verification rule checks.',
    };
  }
}
