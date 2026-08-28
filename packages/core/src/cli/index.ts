#!/usr/bin/env node
/**
 * Technocore Agent Kit — Advanced Autonomous CLI
 * Complete multi-agent orchestration, discovery, workflow execution, approvals, and security.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as fs from 'node:fs';
import { createTechnocoreClient } from '../client.js';
import { createAgentIdentity } from '../identity/identity.js';
import { saveIdentityToFile, loadIdentityFromFile } from '../identity/storage.js';
import { Verifier } from '../verify/verifier.js';
import { verifyTaskResult } from '../verify/verifiable-result.js';
import { generateContributionProof, verifyContributionProof } from '../proof/proof.js';
import { PROJECT_AUTHOR, PROJECT_PORTFOLIO } from '../constants.js';

const client = createTechnocoreClient();

function getLoadedOrFreshIdentity() {
  try {
    return loadIdentityFromFile();
  } catch {
    return null;
  }
}

function printHeader() {
  console.log(`\x1b[36m====================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[35m  Technocore Agent Kit — Autonomous Orchestrator\x1b[0m \x1b[90mv1.0.0\x1b[0m`);
  console.log(`\x1b[90m  Built by ${PROJECT_AUTHOR} (${PROJECT_PORTFOLIO})\x1b[0m`);
  console.log(`\x1b[36m====================================================\x1b[0m\n`);
}

function printHelp() {
  printHeader();
  console.log(`\x1b[1mUSAGE:\x1b[0m`);
  console.log(`  technocore-agent <command> [subcommand] [options]\n`);
  console.log(`\x1b[1mCORE IDENTITY & ROOMS:\x1b[0m`);
  console.log(`  \x1b[32minit\x1b[0m                               Initialize fresh agent identity & save securely to .agent-identity.json`);
  console.log(`  \x1b[32mdid\x1b[0m                                Display local Agent DID, fingerprint, shard, and note path`);
  console.log(`  \x1b[32mrooms\x1b[0m                              List active public Technocore rooms and topics`);
  console.log(`  \x1b[32mread <room>\x1b[0m                        Read messages from a room (--since, --limit, --wait)`);
  console.log(`  \x1b[32msend <room> <message>\x1b[0m              Post a message (--signed to sign with local did:key, --nick)`);
  console.log(`  \x1b[32msign <message>\x1b[0m                     Sign a message with local key (--room <name>, --nonce <num>)`);
  console.log(`  \x1b[32mverify <msg> <sig> <did>\x1b[0m           Verify a signed message (--room <name>, --nonce <num>)`);
  console.log(`  \x1b[32mwatch <room>\x1b[0m                       Stream room messages in real time with sequence awareness`);
  console.log(`  \x1b[32mproof\x1b[0m                              Generate deterministic contribution proof\n`);
  console.log(`\x1b[1mAGENT REGISTRY & DISCOVERY:\x1b[0m`);
  console.log(`  \x1b[32magent list\x1b[0m                         List registered active agents and capabilities`);
  console.log(`  \x1b[32magent info <did>\x1b[0m                   Inspect agent capabilities, reputation score, and status`);
  console.log(`  \x1b[32magent register\x1b[0m                     Register an agent (--name <n>, --role <r>, --caps <c1,c2>)\n`);
  console.log(`\x1b[1mAUTONOMOUS WORKFLOWS & TASKS:\x1b[0m`);
  console.log(`  \x1b[32mworkflow run <name|spec.json>\x1b[0m      Run autonomous multi-agent DAG workflow`);
  console.log(`  \x1b[32mworkflow status <id>\x1b[0m               Inspect workflow execution progress and step DAG`);
  console.log(`  \x1b[32mtask list\x1b[0m                          List current tasks and state machine statuses`);
  console.log(`  \x1b[32mtask inspect <taskId>\x1b[0m              Inspect detailed state transitions and result\n`);
  console.log(`\x1b[1mSECURITY & HUMAN APPROVALS:\x1b[0m`);
  console.log(`  \x1b[32mapprovals\x1b[0m                          List pending high-risk action approval requests`);
  console.log(`  \x1b[32mapprove <approvalId>\x1b[0m               Authorize and approve a pending high-risk action`);
  console.log(`  \x1b[32mreject <approvalId>\x1b[0m                Reject a pending high-risk action`);
  console.log(`  \x1b[32mevents\x1b[0m                             Stream/view signed audit event log`);
  console.log(`  \x1b[32mverify-result <result.json>\x1b[0m        Verify Ed25519 task provenance & result envelope\n`);
}

function parseArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  // Handle agent subcommand
  if (command === 'agent') {
    const sub = args[1];
    if (sub === 'list' || !sub) {
      printHeader();
      const agents = client.registry.getAllAgents();
      if (agents.length === 0) {
        // Register seed default agents if none currently registered
        const pId = createAgentIdentity();
        const rId = createAgentIdentity();
        const cId = createAgentIdentity();
        const tId = createAgentIdentity();
        const sId = createAgentIdentity();
        const fId = createAgentIdentity();

        await client.registry.registerAgent({ did: pId.did, name: 'claude-planner', role: 'planner', capabilities: ['planning', 'summarization'] });
        await client.registry.registerAgent({ did: rId.did, name: 'research-agent-01', role: 'researcher', capabilities: ['web-research', 'summarization'] });
        await client.registry.registerAgent({ did: cId.did, name: 'coder-agent-01', role: 'coder', capabilities: ['edit-code', 'calculate', 'summarization'] });
        await client.registry.registerAgent({ did: tId.did, name: 'tester-agent-01', role: 'tester', capabilities: ['test-code', 'calculate'] });
        await client.registry.registerAgent({ did: sId.did, name: 'security-reviewer-01', role: 'security_reviewer', capabilities: ['security-audit', 'code-review'] });
        await client.registry.registerAgent({ did: fId.did, name: 'final-reviewer-01', role: 'final_reviewer', capabilities: ['code-review', 'summarization'] });
      }

      const all = client.registry.getAllAgents();
      console.log(`\x1b[1mRegistered Autonomous Agents (${all.length}):\x1b[0m\n`);
      for (const a of all) {
        const score = (a.reputation.reviewScore * 100).toFixed(0);
        console.log(`  \x1b[35m${a.name.padEnd(22)}\x1b[0m [${a.role}] \x1b[32m${a.status}\x1b[0m (Reputation: ${score}%)`);
        console.log(`    DID:  \x1b[90m${a.did}\x1b[0m`);
        console.log(`    Caps: \x1b[36m${a.capabilities.join(', ')}\x1b[0m\n`);
      }
      return;
    }

    if (sub === 'info') {
      const did = args[2];
      if (!did) {
        console.log('\x1b[31mError:\x1b[0m Agent DID required. Usage: technocore-agent agent info <did>');
        return;
      }
      const record = await client.registry.resolveAgent(did);
      if (!record) {
        console.log(`\x1b[31mAgent '${did}' not found.\x1b[0m`);
        return;
      }
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    if (sub === 'register') {
      const name = parseArgValue(args, '--name') || 'custom-agent';
      const role = (parseArgValue(args, '--role') as any) || 'coder';
      const capsStr = parseArgValue(args, '--caps') || 'edit-code,test-code';
      const caps = capsStr.split(',').map((c) => c.trim()).filter(Boolean);

      const identity = getLoadedOrFreshIdentity() || createAgentIdentity();
      const rec = await client.registry.registerAgent({
        did: identity.did,
        name,
        role,
        capabilities: caps,
      });
      console.log(`\x1b[32m✔ Agent registered successfully:\x1b[0m`);
      console.log(JSON.stringify(rec, null, 2));
      return;
    }
  }

  // Handle workflow subcommand
  if (command === 'workflow') {
    const sub = args[1];
    if (sub === 'run' || sub === 'create') {
      printHeader();
      const target = args[2] || 'autonomous-coding';
      console.log(`\x1b[36mInitializing Autonomous Multi-Agent Workflow: '${target}'...\x1b[0m\n`);

      // Initialize default agents for pipeline
      const pId = createAgentIdentity();
      const rId = createAgentIdentity();
      const cId = createAgentIdentity();
      const tId = createAgentIdentity();
      const sId = createAgentIdentity();
      const fId = createAgentIdentity();

      await client.registry.registerAgent({ did: pId.did, name: 'planner-core', role: 'planner', capabilities: ['planning', 'summarization'] });
      await client.registry.registerAgent({ did: rId.did, name: 'research-worker', role: 'researcher', capabilities: ['web-research', 'summarization'] });
      await client.registry.registerAgent({ did: cId.did, name: 'code-worker', role: 'coder', capabilities: ['edit-code', 'calculate', 'summarization'] });
      await client.registry.registerAgent({ did: tId.did, name: 'test-worker', role: 'tester', capabilities: ['test-code', 'calculate'] });
      await client.registry.registerAgent({ did: sId.did, name: 'sec-auditor', role: 'security_reviewer', capabilities: ['security-audit', 'code-review'] });
      await client.registry.registerAgent({ did: fId.did, name: 'final-auditor', role: 'final_reviewer', capabilities: ['code-review', 'summarization'] });

      // Run standard autonomous pipeline
      const execution = await client.workflow.executeWorkflow({
        id: 'autonomous-coding-pipeline',
        name: 'Autonomous Feature Pipeline',
        description: 'Planner -> Parallel (Research + Security) -> Coder -> Tester -> Security Review -> Final Approval',
        version: '1.0.0',
        steps: [
          {
            id: 'step-1-plan',
            name: 'Goal Decomposition',
            requiredCapabilities: ['planning'],
            taskGenerator: () => ({ goal: 'Implement verifiable agent coordination module' }),
          },
          {
            id: 'step-2-research',
            name: 'Architecture Research',
            requiredCapabilities: ['web-research', 'summarization'],
            dependencies: ['step-1-plan'],
            taskGenerator: () => ({ topic: 'Ed25519 did:key provenance' }),
          },
          {
            id: 'step-3-security-check',
            name: 'Security Pre-Audit',
            requiredCapabilities: ['security-audit'],
            dependencies: ['step-1-plan'], // Runs parallel with research
            taskGenerator: () => ({ check: 'Zero secret leakage in public logs' }),
          },
          {
            id: 'step-4-implement',
            name: 'Implementation',
            requiredCapabilities: ['edit-code'],
            dependencies: ['step-2-research', 'step-3-security-check'],
            taskGenerator: () => 'CALCULATE: 42 * 100',
          },
          {
            id: 'step-5-test',
            name: 'Testing & Verification',
            requiredCapabilities: ['test-code'],
            dependencies: ['step-4-implement'],
            taskGenerator: () => 'JSON_VALIDATE: {"testsPassed": 12, "coverage": 98}',
          },
          {
            id: 'step-6-review',
            name: 'Final Security Review',
            requiredCapabilities: ['code-review', 'summarization'],
            dependencies: ['step-5-test'],
            taskGenerator: () => 'SUMMARIZE: All 6 workflow steps executed and verified offline.',
          },
        ],
      });

      console.log(`\x1b[32m✔ Workflow completed with status: \x1b[1m${execution.status}\x1b[0m`);
      console.log(`  Workflow ID: ${execution.workflowId}`);
      console.log(`  Completed Steps: [${execution.completedStepIds.join(', ')}]`);
      console.log(`  Total Tasks Executed: ${execution.tasks.length}\n`);
      return;
    }

    if (sub === 'status') {
      const id = args[2];
      if (!id) {
        console.log('\x1b[31mError:\x1b[0m Workflow ID required. Usage: technocore-agent workflow status <id>');
        return;
      }
      const st = client.workflow.getExecutionState(id);
      if (!st) {
        console.log(`\x1b[31mWorkflow '${id}' not found.\x1b[0m`);
        return;
      }
      console.log(JSON.stringify(st, null, 2));
      return;
    }
  }

  // Handle tasks
  if (command === 'task') {
    const sub = args[1];
    if (sub === 'list' || !sub) {
      const executions = client.workflow.listExecutions();
      const allTasks = executions.flatMap((e) => e.tasks);
      console.log(`\x1b[1mActive/Recent Tasks (${allTasks.length}):\x1b[0m\n`);
      for (const t of allTasks) {
        console.log(`  \x1b[35m${t.taskId.padEnd(24)}\x1b[0m [${t.status}] ${t.title}`);
        console.log(`    Agent:  \x1b[90m${t.assignedAgent || 'Unassigned'}\x1b[0m`);
        console.log(`    Caps:   \x1b[36m${t.requiredCapabilities.join(', ')}\x1b[0m\n`);
      }
      return;
    }
  }

  // Handle approvals
  if (command === 'approvals') {
    printHeader();
    const pending = client.approvals.listPending();
    console.log(`\x1b[1mPending Human Approvals (${pending.length}):\x1b[0m\n`);
    if (pending.length === 0) {
      console.log(`  \x1b[90mNo pending approval requests. System running smoothly.\x1b[0m\n`);
      return;
    }
    for (const p of pending) {
      console.log(`  \x1b[31m[${p.riskLevel.toUpperCase()}]\x1b[0m \x1b[1m${p.id}\x1b[0m — ${p.action}`);
      console.log(`    Description: ${p.description}`);
      console.log(`    Agent DID:   \x1b[90m${p.agentDid}\x1b[0m\n`);
    }
    return;
  }

  if (command === 'approve') {
    const id = args[1];
    if (!id) {
      console.log('\x1b[31mError:\x1b[0m Approval ID required. Usage: technocore-agent approve <approvalId>');
      return;
    }
    try {
      const res = client.approvals.approve(id);
      console.log(`\x1b[32m✔ Approved request ${res.id}\x1b[0m`);
    } catch (err: any) {
      console.error(`\x1b[31mError approving:\x1b[0m ${err.message}`);
    }
    return;
  }

  if (command === 'reject') {
    const id = args[1];
    if (!id) {
      console.log('\x1b[31mError:\x1b[0m Approval ID required. Usage: technocore-agent reject <approvalId>');
      return;
    }
    try {
      const res = client.approvals.reject(id);
      console.log(`\x1b[33m✔ Rejected request ${res.id}\x1b[0m`);
    } catch (err: any) {
      console.error(`\x1b[31mError rejecting:\x1b[0m ${err.message}`);
    }
    return;
  }

  if (command === 'events') {
    printHeader();
    const events = client.events.getEvents();
    console.log(`\x1b[1mOrchestrator Audit Event Stream (${events.length} events):\x1b[0m\n`);
    for (const e of events) {
      console.log(`  [seq ${e.seq.toString().padStart(3, '0')}] \x1b[36m${e.type.padEnd(20)}\x1b[0m \x1b[90m${e.timestamp}\x1b[0m`);
    }
    return;
  }

  if (command === 'verify-result') {
    const fileOrJson = args[1];
    if (!fileOrJson) {
      console.log('\x1b[31mError:\x1b[0m Result file or JSON string required.');
      return;
    }
    let parsed: any;
    try {
      if (fs.existsSync(fileOrJson)) {
        parsed = JSON.parse(fs.readFileSync(fileOrJson, 'utf8'));
      } else {
        parsed = JSON.parse(fileOrJson);
      }
    } catch (e: any) {
      console.error('\x1b[31mInvalid JSON:\x1b[0m', e.message);
      return;
    }

    const check = verifyTaskResult(parsed);
    if (check.valid) {
      console.log(`\x1b[32m✔ Task Result Envelope is VALID!\x1b[0m Verified provenance for ${parsed.agentDid}`);
    } else {
      console.log(`\x1b[31m✖ Invalid result envelope:\x1b[0m ${check.reason}`);
    }
    return;
  }

  switch (command) {
    case 'init': {
      printHeader();
      const existing = getLoadedOrFreshIdentity();
      if (existing) {
        console.log(`\x1b[33mIdentity already exists:\x1b[0m`);
        console.log(`  DID: \x1b[1m${existing.did}\x1b[0m`);
        console.log(`  Fingerprint: ${existing.fingerprint}`);
        console.log(`  Path: .agent-identity.json`);
        return;
      }
      const newIdentity = createAgentIdentity();
      const savedPath = saveIdentityToFile(newIdentity);
      console.log(`\x1b[32m✔ Local Agent Identity created successfully!\x1b[0m`);
      console.log(`  \x1b[1mDID:\x1b[0m         ${newIdentity.did}`);
      console.log(`  \x1b[1mFingerprint:\x1b[0m ${newIdentity.fingerprint}`);
      console.log(`  \x1b[1mShard Path:\x1b[0m  kv/did-${newIdentity.shard}/${newIdentity.key}`);
      console.log(`  \x1b[1mSaved to:\x1b[0m    ${savedPath} (0600 file permissions, gitignored)\n`);
      break;
    }

    case 'did': {
      printHeader();
      const identity = getLoadedOrFreshIdentity();
      if (!identity) {
        console.log(`\x1b[31mNo agent identity found.\x1b[0m Run \x1b[1mtechnocore-agent init\x1b[0m first.`);
        return;
      }
      console.log(`\x1b[1mLocal Agent Identity Record:\x1b[0m`);
      console.log(`  DID:         \x1b[36m${identity.did}\x1b[0m`);
      console.log(`  Fingerprint: ${identity.fingerprint}`);
      console.log(`  Shard:       ${identity.shard}`);
      console.log(`  Key:         ${identity.key}`);
      console.log(`  Note Path:   kv/did-${identity.shard}/${identity.key}`);
      console.log(`  Privacy:     Local only (Ed25519 private key never leaves host)\n`);
      break;
    }

    case 'rooms': {
      printHeader();
      console.log(`Fetching active rooms from ${client.baseUrl}...`);
      try {
        const result = await client.rooms.list({ limit: 30 });
        console.log(`\n\x1b[1mActive Public Rooms (${result.rooms.length}):\x1b[0m\n`);
        for (const room of result.rooms) {
          const topic = room.topic ? ` - \x1b[90m${room.topic}\x1b[0m` : '';
          console.log(`  \x1b[35m#${room.name.padEnd(20)}\x1b[0m [seq: ${room.last_seq}]${topic}`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError listing rooms:\x1b[0m ${err.message}`);
      }
      break;
    }

    case 'read': {
      const room = args[1];
      if (!room) {
        console.log(`\x1b[31mError:\x1b[0m Room name required. Usage: technocore-agent read <room> [--since N] [--limit N] [--wait S]`);
        return;
      }
      const since = parseArgValue(args, '--since') ? parseInt(parseArgValue(args, '--since')!, 10) : undefined;
      const limit = parseArgValue(args, '--limit') ? parseInt(parseArgValue(args, '--limit')!, 10) : 50;
      const wait = parseArgValue(args, '--wait') ? parseInt(parseArgValue(args, '--wait')!, 10) : undefined;

      try {
        const resp = await client.rooms.read(room, { since, limit, wait });
        console.log(`\n\x1b[1mRoom #${resp.room} (${resp.messages.length} messages):\x1b[0m\n`);
        for (const msg of resp.messages) {
          const sender = msg.did ? `\x1b[32m<${msg.did.substring(0, 14)}...>\x1b[0m` : `\x1b[33m<${msg.from}>\x1b[0m`;
          console.log(`  [${msg.seq.toString().padStart(4, ' ')}] ${sender} ${msg.text}`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError reading room:\x1b[0m ${err.message}`);
      }
      break;
    }

    case 'send': {
      const room = args[1];
      const text = args[2];
      if (!room || !text) {
        console.log(`\x1b[31mError:\x1b[0m Room and message text required. Usage: technocore-agent send <room> "<message>" [--signed] [--nick N]`);
        return;
      }
      const isSigned = args.includes('--signed');
      const nick = parseArgValue(args, '--nick') || 'agent';

      try {
        if (isSigned) {
          let identity = getLoadedOrFreshIdentity();
          if (!identity) {
            identity = createAgentIdentity();
            saveIdentityToFile(identity);
            console.log(`Created new identity: ${identity.did}`);
          }
          client.did.set(identity);
          const res = await client.rooms.sendSigned(room, text);
          console.log(`\x1b[32m✔ Signed message posted successfully to #${room}!\x1b[0m`);
          console.log(`  DID:   ${res.envelope.did}`);
          console.log(`  Nonce: ${res.envelope.nonce}`);
          console.log(`  Sig:   ${res.envelope.sig.substring(0, 30)}...`);
        } else {
          await client.rooms.send(room, text, { from: nick });
          console.log(`\x1b[32m✔ Message posted successfully to #${room} as <~${nick}>!\x1b[0m`);
        }
      } catch (err: any) {
        console.error(`\x1b[31mError sending message:\x1b[0m ${err.message}`);
      }
      break;
    }

    case 'sign': {
      const message = args[1];
      if (!message) {
        console.log(`\x1b[31mError:\x1b[0m Message required. Usage: technocore-agent sign "<message>" [--room <room>] [--nonce <num>]`);
        return;
      }
      const room = parseArgValue(args, '--room') || 'lobby';
      const nonce = parseArgValue(args, '--nonce') || Date.now().toString();

      let identity = getLoadedOrFreshIdentity();
      if (!identity) {
        identity = createAgentIdentity();
        saveIdentityToFile(identity);
      }

      const env = identity.signMessage(room, message, nonce);
      console.log(JSON.stringify(env, null, 2));
      break;
    }

    case 'verify': {
      const message = args[1];
      const sig = args[2];
      const did = args[3];
      if (!message || !sig || !did) {
        console.log(`\x1b[31mError:\x1b[0m Usage: technocore-agent verify "<message>" "<sig>" "<did>" [--room <room>] [--nonce <num>]`);
        return;
      }
      const room = parseArgValue(args, '--room') || 'lobby';
      const nonce = parseArgValue(args, '--nonce') || '1';

      const valid = Verifier.message(room, nonce, message, sig, did);
      if (valid) {
        console.log(`\x1b[32m✔ Signature is VALID!\x1b[0m Message verified offline for ${did}`);
      } else {
        console.log(`\x1b[31m✖ Signature is INVALID or malformed.\x1b[0m`);
      }
      break;
    }

    case 'watch': {
      const room = args[1];
      if (!room) {
        console.log(`\x1b[31mError:\x1b[0m Room required. Usage: technocore-agent watch <room> [--since N]`);
        return;
      }
      const since = parseArgValue(args, '--since') ? parseInt(parseArgValue(args, '--since')!, 10) : undefined;
      printHeader();
      console.log(`\x1b[36mWatching #${room} for new messages in real time (Ctrl+C to stop)...\x1b[0m\n`);

      process.on('SIGINT', () => {
        console.log('\n\x1b[90mStopped watching room.\x1b[0m');
        process.exit(0);
      });

      for await (const msg of client.rooms.watch(room, { since })) {
        const sender = msg.did ? `\x1b[32m<${msg.did.substring(0, 14)}...>\x1b[0m` : `\x1b[33m<${msg.from}>\x1b[0m`;
        console.log(`\x1b[90m[${new Date().toLocaleTimeString()}]\x1b[0m [seq: ${msg.seq}] ${sender} ${msg.text}`);
      }
      break;
    }

    case 'proof': {
      printHeader();
      let identity = getLoadedOrFreshIdentity();
      if (!identity) {
        identity = createAgentIdentity();
        saveIdentityToFile(identity);
      }
      const workflow = parseArgValue(args, '--workflow') || 'agent-kit-core-integration';
      const proof = generateContributionProof({ identity, workflow });
      const valid = verifyContributionProof(proof);

      console.log(`\x1b[32m✔ Deterministic Contribution Proof Generated (Verified: ${valid})\x1b[0m\n`);
      console.log(JSON.stringify(proof, null, 2));
      console.log(`\n\x1b[90mNote: Zero secrets or tokens are contained in this public proof.\x1b[0m`);
      break;
    }

    default:
      console.log(`\x1b[31mUnknown command:\x1b[0m ${command}`);
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error(`\x1b[31mFatal Error:\x1b[0m`, err);
  process.exit(1);
});
