/**
 * Technocore Agent Kit — Autonomous Coding Pipeline Example
 * Real multi-agent workflow:
 * Human -> Claude Planner -> Parallel(Research + Security) -> Coder -> Tester -> Security Audit -> Final Signoff
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import {
  createTechnocoreClient,
  createAgentIdentity,
  type WorkflowDefinition,
} from '@technocore/agent-kit';

export async function runAutonomousCodingPipeline(goal = 'Build secure verifiable token-faucet module for Technocore') {
  console.log(`\n\x1b[36m========================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[35m  TECHNOCORE AGENT KIT — AUTONOMOUS CODING PIPELINE\x1b[0m`);
  console.log(`  Goal: \x1b[33m"${goal}"\x1b[0m`);
  console.log(`\x1b[36m========================================================================\x1b[0m\n`);

  const client = createTechnocoreClient();
  const controllerId = client.did.create();

  console.log(`\x1b[1m[1/6] Initializing Specialized Autonomous Agents with Ed25519 DIDs...\x1b[0m`);

  const plannerId = createAgentIdentity();
  const researcherId = createAgentIdentity();
  const coderId = createAgentIdentity();
  const testerId = createAgentIdentity();
  const securityId = createAgentIdentity();
  const reviewerId = createAgentIdentity();

  await client.registry.registerAgent({
    did: plannerId.did,
    name: 'claude-planner',
    role: 'planner',
    capabilities: ['planning', 'summarization'],
  });

  await client.registry.registerAgent({
    did: researcherId.did,
    name: 'research-agent-01',
    role: 'researcher',
    capabilities: ['web-research', 'summarization', 'memory-management'],
  });

  await client.registry.registerAgent({
    did: coderId.did,
    name: 'coder-agent-01',
    role: 'coder',
    capabilities: ['edit-code', 'calculate', 'summarization', 'memory-management'],
  });

  await client.registry.registerAgent({
    did: testerId.did,
    name: 'tester-agent-01',
    role: 'tester',
    capabilities: ['test-code', 'calculate', 'summarization'],
  });

  await client.registry.registerAgent({
    did: securityId.did,
    name: 'security-reviewer-01',
    role: 'security_reviewer',
    capabilities: ['security-audit', 'code-review', 'summarization'],
  });

  await client.registry.registerAgent({
    did: reviewerId.did,
    name: 'final-reviewer-01',
    role: 'final_reviewer',
    capabilities: ['code-review', 'summarization'],
  });

  console.log(`  ✔ 6 Agents registered with capability advertisements in AgentRegistry\n`);

  // Subscribe to real-time observability stream
  client.events.subscribeAll((event) => {
    const time = new Date(event.timestamp).toLocaleTimeString();
    console.log(`  \x1b[90m[${time}]\x1b[0m \x1b[36m${event.type.padEnd(20)}\x1b[0m \x1b[90m${event.taskId || ''}\x1b[0m`);
  });

  console.log(`\x1b[1m[2/6] Decomposing High-Level Goal via AI Provider...\x1b[0m`);
  const aiProvider = client.providers.create('local');
  const plan = await aiProvider.createPlan(goal);
  console.log(`  Plan Title: \x1b[32m${plan.planTitle}\x1b[0m`);
  console.log(`  Decomposed Steps: \x1b[33m${plan.steps.length} steps\x1b[0m\n`);

  console.log(`\x1b[1m[3/6] Compiling DAG Workflow Definition & Executing Parallel Branches...\x1b[0m`);

  const workflowDef: WorkflowDefinition = {
    id: 'feature-pipeline-dag',
    name: 'Autonomous Feature Pipeline',
    description: 'Decomposed autonomous feature execution',
    version: '1.0.0',
    steps: plan.steps.map((step) => ({
      id: step.stepId,
      name: step.title,
      requiredCapabilities: step.requiredCapabilities,
      dependencies: step.dependsOn,
      riskLevel: step.riskLevel,
      requiresHumanApproval: step.requiresHumanApproval,
      taskGenerator: () => ({
        instruction: step.instruction,
        role: step.role,
        targetGoal: goal,
      }),
    })),
  };

  const execution = await client.workflow.executeWorkflow(workflowDef, { goal });

  console.log(`\n\x1b[1m[4/6] Workflow Completed!\x1b[0m`);
  console.log(`  Status: \x1b[32m${execution.status}\x1b[0m`);
  console.log(`  Completed Steps: [${execution.completedStepIds.join(', ')}]`);
  console.log(`  Tasks Executed: ${execution.tasks.length}\n`);

  console.log(`\x1b[1m[5/6] Verifying Cryptographic Provenance & Signatures on Task Envelopes...\x1b[0m`);
  for (const task of execution.tasks) {
    if (task.verifiableResult) {
      const verification = client.verify.verifyTaskResult(task.verifiableResult, {
        taskId: task.taskId,
        workflowId: task.workflowId,
      });
      console.log(`  Task \x1b[35m${task.taskId}\x1b[0m (${task.title}): ${verification.valid ? '\x1b[32m✔ Verified Ed25519 Signature\x1b[0m' : '\x1b[31m✖ Invalid\x1b[0m'}`);
      console.log(`    Input Hash:  \x1b[90m${task.verifiableResult.inputHash.slice(0, 16)}...\x1b[0m`);
      console.log(`    Output Hash: \x1b[90m${task.verifiableResult.outputHash.slice(0, 16)}...\x1b[0m`);
      console.log(`    Agent DID:   \x1b[90m${task.verifiableResult.agentDid}\x1b[0m`);
    }
  }

  console.log(`\n\x1b[1m[6/6] Writing Final Result to Structured Verified Team Memory...\x1b[0m`);
  await client.memory.write(
    'verified',
    'autonomous-builds',
    'token-faucet-v1',
    {
      goal,
      status: execution.status,
      tasksCompleted: execution.completedStepIds.length,
      artifacts: execution.results,
    },
    controllerId
  );
  console.log(`  ✔ Artifact stored in verified memory scope with CAS protection\n`);
  console.log(`\x1b[32m✔ Pipeline execution completed successfully!\x1b[0m\n`);

  return execution;
}

// Run immediately if invoked as main entrypoint
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('autonomous-coding-pipeline.js')) {
  runAutonomousCodingPipeline().catch((err) => {
    console.error('Pipeline Error:', err);
    process.exit(1);
  });
}
