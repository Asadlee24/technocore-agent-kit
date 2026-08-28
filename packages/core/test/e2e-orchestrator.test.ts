import { test } from 'node:test';
import * as assert from 'node:assert';
import { createTechnocoreClient } from '../src/client.js';
import { createAgentIdentity } from '../src/identity/identity.js';
import type { WorkflowDefinition } from '../src/types.js';

test('E2E Autonomous Multi-Agent Orchestration: Planner -> Parallel(Research + Security) -> Coder -> Tester -> Security Review -> Final Attestation', async () => {
  const kvStore = new Map<string, string>();
  const mockFetch: typeof fetch = async (url: any, init: any = {}) => {
    const urlStr = url.toString();
    if (init.method === 'POST' || urlStr.includes('/set/')) {
      return { ok: true, status: 200, text: async () => 'OK', json: async () => ({}) } as any;
    }
    return { ok: true, status: 200, text: async () => '', json: async () => ({}) } as any;
  };

  const client = createTechnocoreClient({ fetchFn: mockFetch });
  const controller = client.did.create();

  // 1. Initialize specialized agents
  const plannerId = createAgentIdentity();
  const researcherId = createAgentIdentity();
  const coderId = createAgentIdentity();
  const testerId = createAgentIdentity();
  const securityId = createAgentIdentity();
  const reviewerId = createAgentIdentity();

  await client.registry.registerAgent({ did: plannerId.did, name: 'claude-planner', role: 'planner', capabilities: ['planning', 'summarization'] });
  await client.registry.registerAgent({ did: researcherId.did, name: 'research-node', role: 'researcher', capabilities: ['web-research', 'summarization', 'memory-management'] });
  await client.registry.registerAgent({ did: coderId.did, name: 'coder-node', role: 'coder', capabilities: ['edit-code', 'calculate', 'summarization'] });
  await client.registry.registerAgent({ did: testerId.did, name: 'tester-node', role: 'tester', capabilities: ['test-code', 'calculate'] });
  await client.registry.registerAgent({ did: securityId.did, name: 'security-reviewer-node', role: 'security_reviewer', capabilities: ['security-audit', 'code-review'] });
  await client.registry.registerAgent({ did: reviewerId.did, name: 'final-reviewer-node', role: 'final_reviewer', capabilities: ['code-review', 'summarization'] });

  // 2. Track emitted events
  const emittedEvents: string[] = [];
  client.events.subscribeAll((evt) => {
    emittedEvents.push(evt.type);
  });

  // 3. AI Provider Plan Generation
  const provider = client.providers.create('local');
  const plan = await provider.createPlan('Build high-performance rate-limiter module');
  assert.ok(plan.steps.length >= 4);

  // 4. Construct and execute complete DAG workflow
  const workflowDef: WorkflowDefinition = {
    id: 'e2e-rate-limiter-build',
    name: 'Autonomous Rate Limiter Build',
    description: 'Full E2E multi-agent development workflow',
    version: '1.0.0',
    steps: [
      {
        id: 'step-1-plan',
        name: 'Requirement Planning',
        requiredCapabilities: ['planning'],
        dependencies: [],
        taskGenerator: () => 'SUMMARIZE: Sliding window bucket algorithm with 100 req/sec ceiling',
      },
      {
        id: 'step-2-research',
        name: 'Algorithm Research',
        requiredCapabilities: ['web-research'],
        dependencies: ['step-1-plan'],
        taskGenerator: () => 'SUMMARIZE: Sliding window counter benchmarks',
      },
      {
        id: 'step-3-sec-check',
        name: 'Threat Modeling',
        requiredCapabilities: ['security-audit'],
        dependencies: ['step-1-plan'], // Parallel with research
        taskGenerator: () => 'SUMMARIZE: DoS amplification and lock contention mitigation',
      },
      {
        id: 'step-4-coder',
        name: 'Implement Rate Limiter',
        requiredCapabilities: ['edit-code', 'calculate'],
        dependencies: ['step-2-research', 'step-3-sec-check'],
        taskGenerator: () => 'CALCULATE: 1000 / 10',
      },
      {
        id: 'step-5-tester',
        name: 'Stress Testing',
        requiredCapabilities: ['test-code'],
        dependencies: ['step-4-coder'],
        taskGenerator: () => 'JSON_VALIDATE: {"passed": 24, "failed": 0, "p99LatencyMs": 0.4}',
      },
      {
        id: 'step-6-security-audit',
        name: 'Security Audit',
        requiredCapabilities: ['security-audit', 'code-review'],
        dependencies: ['step-5-tester'],
        taskGenerator: () => 'SUMMARIZE: Zero vulnerability findings. Memory safe.',
      },
      {
        id: 'step-7-final-review',
        name: 'Final Provenance Signoff',
        requiredCapabilities: ['code-review', 'summarization'],
        dependencies: ['step-6-security-audit'],
        taskGenerator: () => 'SUMMARIZE: All checks passed. Ready for signoff.',
      },
    ],
  };

  const execution = await client.workflow.executeWorkflow(workflowDef);

  // Assertions
  assert.strictEqual(execution.status, 'COMPLETED');
  assert.strictEqual(execution.completedStepIds.length, 7);
  assert.strictEqual(execution.tasks.length, 7);
  assert.ok(emittedEvents.includes('WORKFLOW_STARTED'));
  assert.ok(emittedEvents.includes('WORKFLOW_COMPLETED'));
  assert.ok(emittedEvents.includes('RESULT_VERIFIED'));

  // 5. Verify cryptographic provenance on all task envelopes
  for (const task of execution.tasks) {
    assert.ok(task.verifiableResult);
    const verification = client.verify.verifyTaskResult(task.verifiableResult, {
      taskId: task.taskId,
      workflowId: task.workflowId,
    });
    assert.strictEqual(verification.valid, true);
  }

  // 6. Test Structured Scoped Memory persistence
  const memWrite = await client.memory.write(
    'verified',
    'builds',
    'rate-limiter-v1',
    { status: execution.status, tasks: 7 },
    controller
  );
  assert.strictEqual(memWrite.success, true);

  const memRead = await client.memory.read('verified', 'builds', 'rate-limiter-v1');
  assert.ok(memRead);
  assert.strictEqual(memRead.value.tasks, 7);
});
