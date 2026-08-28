import { test } from 'node:test';
import * as assert from 'node:assert';
import { WorkflowEngine } from '../src/orchestrator/workflow-engine.js';
import { AgentRegistry } from '../src/registry/registry.js';
import { TaskRouter } from '../src/router/router.js';
import { HumanApprovalEngine } from '../src/security/approvals.js';
import { OrchestratorEventStream } from '../src/events/event-stream.js';
import { createAgentIdentity } from '../src/identity/identity.js';
import type { WorkflowDefinition } from '../src/types.js';

test('WorkflowEngine: executes DAG workflow with parallel branches and dependencies', async () => {
  const registry = new AgentRegistry();
  const router = new TaskRouter(registry);
  const approvals = new HumanApprovalEngine();
  const events = new OrchestratorEventStream();
  const controllerId = createAgentIdentity();

  // Register worker agents
  const rId = createAgentIdentity();
  const cId = createAgentIdentity();
  const sId = createAgentIdentity();

  await registry.registerAgent({
    did: rId.did,
    name: 'researcher',
    role: 'researcher',
    capabilities: ['web-research', 'summarization'],
  });

  await registry.registerAgent({
    did: sId.did,
    name: 'security-guard',
    role: 'security_reviewer',
    capabilities: ['security-audit', 'code-review'],
  });

  await registry.registerAgent({
    did: cId.did,
    name: 'coder',
    role: 'coder',
    capabilities: ['edit-code', 'calculate', 'summarization'],
  });

  const engine = new WorkflowEngine({
    registry,
    router,
    approvals,
    events,
    controllerIdentity: controllerId,
  });

  const workflowDef: WorkflowDefinition = {
    id: 'test-parallel-dag',
    name: 'Parallel Branch Test',
    description: 'Runs research & security in parallel, then joins at coder',
    version: '1.0.0',
    steps: [
      {
        id: 'step-research',
        name: 'Market Research',
        requiredCapabilities: ['web-research'],
        dependencies: [],
        taskGenerator: () => 'SUMMARIZE: Market research data point 1',
      },
      {
        id: 'step-sec-audit',
        name: 'Security Audit',
        requiredCapabilities: ['security-audit'],
        dependencies: [], // Parallel with research
        taskGenerator: () => 'SUMMARIZE: Security check passed cleanly',
      },
      {
        id: 'step-code-feature',
        name: 'Implement Feature',
        requiredCapabilities: ['edit-code', 'calculate'],
        dependencies: ['step-research', 'step-sec-audit'], // Joins both branches
        taskGenerator: () => 'CALCULATE: (100 * 2) + 50',
      },
    ],
  };

  const result = await engine.executeWorkflow(workflowDef);

  assert.strictEqual(result.status, 'COMPLETED');
  assert.strictEqual(result.completedStepIds.length, 3);
  assert.strictEqual(result.failedStepIds.length, 0);
  assert.ok(result.results['step-code-feature']);
  assert.strictEqual(result.tasks.length, 3);

  // Every task must have a verifiable result envelope with valid signature
  for (const t of result.tasks) {
    assert.ok(t.verifiableResult);
    assert.ok(t.verifiableResult.signature);
  }
});
