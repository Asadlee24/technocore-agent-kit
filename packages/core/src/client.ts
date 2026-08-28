/**
 * Technocore Agent Kit — Main SDK Client & Autonomous Operating System
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { DEFAULT_BASE_URL } from './constants.js';
import type { TechnocoreClientConfig } from './types.js';
import { RoomsClient } from './rooms/rooms.js';
import { NotesClient } from './notes/notes.js';
import { Verifier } from './verify/verifier.js';
import { createVerifiableResult, verifyTaskResult } from './verify/verifiable-result.js';
import { MetaClient } from './meta/meta.js';
import { AgentIdentity, createAgentIdentity, loadAgentIdentity } from './identity/identity.js';
import { loadIdentityFromFile, saveIdentityToFile } from './identity/storage.js';
import { singleLineSweep, wrapUntrustedMessage, isValidRoomName } from './safety/sanitizer.js';
import { PermissionGuard } from './security/permissions.js';
import { HumanApprovalEngine } from './security/approvals.js';
import { AgentRegistry } from './registry/registry.js';
import { TaskRouter } from './router/router.js';
import { AgentMemory } from './memory/memory.js';
import { OrchestratorEventStream } from './events/event-stream.js';
import { WorkflowEngine } from './orchestrator/workflow-engine.js';
import { TaskStateMachine } from './orchestrator/state-machine.js';
import { createAIProvider } from './providers/index.js';
import { generateContributionProof, verifyContributionProof } from './proof/proof.js';
import { processTask } from './tasks/tasks.js';

export class TechnocoreClient {
  public readonly baseUrl: string;
  public readonly rooms: RoomsClient;
  public readonly notes: NotesClient;
  public readonly meta: MetaClient;
  public readonly verify = {
    envelope: Verifier.envelope,
    message: Verifier.message,
    note: Verifier.note,
    taskResult: verifyTaskResult,
    createTaskResult: createVerifiableResult,
    verifyTaskResult: verifyTaskResult,
  };
  public readonly safety = {
    singleLineSweep,
    wrapUntrustedMessage,
    isValidRoomName,
    permissions: PermissionGuard,
  };
  public readonly proof = {
    generate: generateContributionProof,
    verify: verifyContributionProof,
  };
  public readonly tasks = {
    process: processTask,
    stateMachine: TaskStateMachine,
  };
  public readonly registry: AgentRegistry;
  public readonly router: TaskRouter;
  public readonly approvals: HumanApprovalEngine;
  public readonly memory: AgentMemory;
  public readonly events: OrchestratorEventStream;
  public readonly workflow: WorkflowEngine;
  public readonly orchestrator: WorkflowEngine;
  public readonly providers = {
    create: createAIProvider,
  };

  private currentIdentity?: AgentIdentity;

  constructor(config: TechnocoreClientConfig & { identity?: AgentIdentity } = {}) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.currentIdentity = config.identity;

    this.rooms = new RoomsClient({
      baseUrl: this.baseUrl,
      defaultNick: config.defaultNick,
      identity: this.currentIdentity,
      fetchFn: config.fetchFn,
    });

    this.notes = new NotesClient({
      baseUrl: this.baseUrl,
      identity: this.currentIdentity,
      fetchFn: config.fetchFn,
    });

    this.meta = new MetaClient({
      baseUrl: this.baseUrl,
      fetchFn: config.fetchFn,
    });

    this.registry = new AgentRegistry({
      notesClient: this.notes,
    });

    this.router = new TaskRouter(this.registry);
    this.approvals = new HumanApprovalEngine();
    this.memory = new AgentMemory({ notesClient: this.notes });
    this.events = new OrchestratorEventStream();

    this.workflow = new WorkflowEngine({
      registry: this.registry,
      router: this.router,
      approvals: this.approvals,
      events: this.events,
      controllerIdentity: this.currentIdentity,
    });

    this.orchestrator = this.workflow;
  }

  public readonly did = {
    create: (): AgentIdentity => {
      const id = createAgentIdentity();
      this.setIdentity(id);
      return id;
    },
    load: (secret: Uint8Array | string): AgentIdentity => {
      const id = loadAgentIdentity(secret);
      this.setIdentity(id);
      return id;
    },
    loadFromFile: (filePath?: string): AgentIdentity => {
      const id = loadIdentityFromFile(filePath);
      this.setIdentity(id);
      return id;
    },
    saveToFile: (identity?: AgentIdentity, filePath?: string): string => {
      const id = identity || this.currentIdentity;
      if (!id) throw new Error('No identity available to save.');
      return saveIdentityToFile(id, { filePath });
    },
    get: (): AgentIdentity | undefined => {
      return this.currentIdentity;
    },
    set: (identity: AgentIdentity): void => {
      this.setIdentity(identity);
    },
    sign: (room: string, text: string, nonce?: string | number) => {
      if (!this.currentIdentity) throw new Error('No active identity set on client. Call client.did.create() or client.did.load() first.');
      return this.currentIdentity.signMessage(room, text, nonce);
    },
    signNote: (namespace: string, key: string, value: string, nonce: string | number) => {
      if (!this.currentIdentity) throw new Error('No active identity set on client.');
      return this.currentIdentity.signNote(namespace, key, value, nonce);
    },
  };

  public setIdentity(identity: AgentIdentity): void {
    this.currentIdentity = identity;
    this.rooms.setIdentity(identity);
    this.notes.setIdentity(identity);
    this.workflow.setControllerIdentity(identity);
  }
}

/**
 * Creates an instance of TechnocoreClient
 */
export function createTechnocoreClient(config?: TechnocoreClientConfig & { identity?: AgentIdentity }): TechnocoreClient {
  return new TechnocoreClient(config);
}
