import { test } from 'node:test';
import * as assert from 'node:assert';
import { AgentRegistry } from '../src/registry/registry.js';
import { TaskRouter } from '../src/router/router.js';
import { createAgentIdentity } from '../src/identity/identity.js';

test('AgentRegistry & TaskRouter: register, discover, and route based on capability matching', async () => {
  const registry = new AgentRegistry();
  const router = new TaskRouter(registry);

  const agent1 = createAgentIdentity();
  const agent2 = createAgentIdentity();

  await registry.registerAgent({
    did: agent1.did,
    name: 'researcher-node',
    role: 'researcher',
    capabilities: ['web-research', 'summarization'],
  });

  await registry.registerAgent({
    did: agent2.did,
    name: 'coder-node',
    role: 'coder',
    capabilities: ['edit-code', 'test-code'],
  });

  // Discovery filter check
  const researchers = await registry.discoverAgents({ capabilities: ['web-research'] });
  assert.strictEqual(researchers.length, 1);
  assert.strictEqual(researchers[0].name, 'researcher-node');

  const coders = await registry.discoverAgents({ capabilities: ['edit-code'] });
  assert.strictEqual(coders.length, 1);
  assert.strictEqual(coders[0].name, 'coder-node');

  // Route task to coder
  const routedAgent = await router.routeTask({
    taskId: 't-100',
    workflowId: 'wf-100',
    title: 'Code Refactor',
    description: 'Refactor module',
    requiredCapabilities: ['edit-code'],
    input: {},
  });

  assert.strictEqual(routedAgent.did, agent2.did);
  assert.strictEqual(router.getActiveWorkload(agent2.did), 1);

  router.recordTaskFinished(agent2.did);
  assert.strictEqual(router.getActiveWorkload(agent2.did), 0);
});

test('AgentRegistry: reputation scoring updates accurately', async () => {
  const registry = new AgentRegistry();
  const id = createAgentIdentity();

  await registry.registerAgent({
    did: id.did,
    name: 'reliable-worker',
    role: 'coder',
    capabilities: ['edit-code'],
  });

  // Record 3 successful tasks
  registry.recordReputation(id.did, { success: true, latencyMs: 120 });
  registry.recordReputation(id.did, { success: true, latencyMs: 140 });
  registry.recordReputation(id.did, { success: true, latencyMs: 100 });

  let agent = await registry.resolveAgent(id.did);
  assert.ok(agent);
  assert.strictEqual(agent.reputation.tasksCompleted, 3);
  assert.strictEqual(agent.reputation.tasksFailed, 0);
  assert.strictEqual(agent.reputation.reviewScore, 1.0);

  // Record 1 failure
  registry.recordReputation(id.did, { success: false, latencyMs: 500 });
  agent = await registry.resolveAgent(id.did);
  assert.ok(agent);
  assert.strictEqual(agent.reputation.tasksCompleted, 3);
  assert.strictEqual(agent.reputation.tasksFailed, 1);
  assert.strictEqual(agent.reputation.reviewScore, 0.75); // 3/4
});
