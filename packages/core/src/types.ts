/**
 * Technocore Agent Kit — Types & Schemas
 * Comprehensive types for Autonomous Multi-Agent Orchestration,
 * Ed25519 Identities, Workflows, Capability Routing, Security, and Memory.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

export type RoomClass = 'p-' | 'mb-' | 'd-' | 'e-';

export interface RoomMessage {
  seq: number;
  ts?: string;
  from: string;
  text: string;
  did?: string;
  nonce?: string;
  sig?: string;
  verified?: boolean;
}

export interface RoomReadResponse {
  room: string;
  first_seq?: number;
  last_seq?: number;
  count: number;
  messages: RoomMessage[];
  rawText?: string;
}

export interface RoomListItem {
  name: string;
  room?: string;
  last_seq: number;
  size_bytes?: number;
  bytes?: number;
  idle_seconds?: number;
  topic?: string;
  messages_count?: number;
}

export interface RoomListResponse {
  rooms: RoomListItem[];
  total_rooms?: number;
  engagement?: {
    window?: number;
    zero_response_share?: number;
    nick_diversity?: number;
    windowed_note_to_message_ratio?: number;
  };
}

export interface AgentKeyPair {
  publicKeyDer: Uint8Array;
  publicKeyRaw: Uint8Array; // 32-byte Ed25519 raw public key
  privateKeyDer: Uint8Array;
  privateKeyRaw?: Uint8Array; // 32-byte Ed25519 raw private seed/key
  did: string; // did:key:z6Mk...
  fingerprint: string; // 16 hex chars
  shard: string; // first 2 hex chars
  key: string; // remaining 14 hex chars
}

export interface SignedMessageEnvelope {
  did: string;
  sig: string;
  nonce: string;
  text: string;
  room: string;
}

export interface SignedNoteEnvelope {
  did: string;
  sig: string;
  nonce: string;
  value: string;
  namespace: string;
  key: string;
}

export interface ReadRoomOptions {
  since?: number;
  wait?: number; // 0 to 10 seconds
  limit?: number; // 1 to 200
  format?: 'json' | 'text';
  n?: number; // Cache-buster counter
}

export interface WaitRoomOptions {
  since: number;
  wait?: number;
}

export interface SendMessageOptions {
  from?: string;
  usePost?: boolean;
}

export interface SendSignedOptions {
  nonce?: string | number;
  usePost?: boolean;
}

export interface WatchRoomOptions {
  since?: number;
  pollIntervalMs?: number;
  waitSeconds?: number;
  maxRetries?: number;
  stopSignal?: AbortSignal;
  onDuplicateRefused?: (err: Error) => void;
  onRateLimited?: (retryAfterSeconds: number) => void;
}

export interface SetNoteOptions {
  if?: string;
  ifAbsent?: boolean;
  usePost?: boolean;
}

export interface SetSignedNoteOptions {
  nonce?: string | number;
}

export interface PublishDidOptions {
  x25519Pub?: string;
  mailbox?: string;
  extra?: Record<string, string>;
}

export interface ResolvedDidRecord {
  did: string;
  fingerprint: string;
  rawText: string;
  x25519Pub?: string;
  mailbox?: string;
  metadata: Record<string, string>;
}

export interface TechnocoreClientConfig {
  baseUrl?: string;
  defaultNick?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchFn?: typeof fetch;
}

export interface ContributionProof {
  proofVersion: string;
  agentDid: string;
  agentFingerprint: string;
  project: string;
  repository: string;
  author: string;
  workflow: string;
  protocolEndpoint: string;
  timestampUtc: string;
  nonce: string;
  signature: string;
  signedPayload: string;
}

// ─── AGENT REGISTRY & CAPABILITIES ──────────────────────────────────────────

export type AgentRole =
  | 'planner'
  | 'researcher'
  | 'coder'
  | 'tester'
  | 'security_reviewer'
  | 'final_reviewer'
  | 'deployer'
  | 'controller'
  | 'custom';

export type AgentCapability =
  | 'planning'
  | 'web-research'
  | 'summarization'
  | 'edit-code'
  | 'test-code'
  | 'security-audit'
  | 'code-review'
  | 'deploy'
  | 'calculate'
  | 'memory-management'
  | string;

export interface AgentReputation {
  tasksCompleted: number;
  tasksFailed: number;
  verificationFailures: number;
  averageResponseTimeMs: number;
  successfulRetries: number;
  reviewScore: number; // 0.0 to 1.0
  lastUpdated: string;
}

export interface AgentRecord {
  did: string;
  name: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  status: 'online' | 'busy' | 'offline' | 'degraded';
  version: string;
  mailbox?: string;
  endpoint?: string;
  reputation: AgentReputation;
  lastHeartbeat: string;
  metadata?: Record<string, any>;
}

export interface AgentAdvertisement {
  did: string;
  name: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  status?: 'online' | 'busy' | 'offline';
  version?: string;
  mailbox?: string;
  metadata?: Record<string, any>;
}

// ─── TASK LIFECYCLE & STATE MACHINE ──────────────────────────────────────────

export type TaskStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'ASSIGNED'
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELLED'
  | 'REJECTED';

export interface TaskDefinition {
  taskId: string;
  parentTaskId?: string;
  workflowId: string;
  title: string;
  description: string;
  requiredCapabilities: AgentCapability[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
  assignedAgent?: string; // did:key:...
  input: any;
  deadline?: string;
  timeoutMs?: number;
  maxRetries?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  requiresHumanApproval?: boolean;
}

export interface TaskStateTransition {
  from: TaskStatus;
  to: TaskStatus;
  timestamp: string;
  reason?: string;
  actorDid?: string;
}

export interface TaskRecord extends TaskDefinition {
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  attempt: number;
  transitions: TaskStateTransition[];
  result?: any;
  error?: string;
  signature?: string;
  verifiableResult?: VerifiableTaskResultEnvelope;
}

// ─── VERIFIABLE RESULTS & PROVENANCE ────────────────────────────────────────

export interface VerifiableTaskResultEnvelope {
  taskId: string;
  workflowId: string;
  agentDid: string;
  inputHash: string; // SHA-256 of canonical task input
  outputHash: string; // SHA-256 of canonical task result
  timestamp: string;
  nonce: string;
  signature: string; // Ed25519 signature over "<taskId>|<workflowId>|<inputHash>|<outputHash>|<timestamp>|<nonce>"
  success: boolean;
  resultPayload: any;
}

// ─── WORKFLOW ENGINE & DAG ──────────────────────────────────────────────────

export type WorkflowStepType =
  | 'SEQUENTIAL'
  | 'PARALLEL'
  | 'DEPENDENCY'
  | 'CONDITIONAL'
  | 'RETRY'
  | 'TIMEOUT'
  | 'HUMAN_APPROVAL'
  | 'ROLLBACK';

export interface WorkflowStep {
  id: string;
  name: string;
  type?: WorkflowStepType;
  requiredCapabilities: AgentCapability[];
  dependencies?: string[]; // IDs of prerequisite steps
  condition?: (context: WorkflowExecutionContext) => boolean | Promise<boolean>;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  requiresHumanApproval?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  rollbackStepId?: string;
  taskGenerator: (context: WorkflowExecutionContext) => any | Promise<any>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  onFailure?: 'abort' | 'rollback' | 'continue';
}

export interface WorkflowExecutionContext {
  workflowId: string;
  stepResults: Map<string, any>;
  stepTasks: Map<string, TaskRecord>;
  memory: Map<string, any>;
  metadata: Record<string, any>;
  startedAt: string;
}

export type WorkflowStatus = 'IDLE' | 'RUNNING' | 'PAUSED_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface WorkflowExecutionState {
  workflowId: string;
  definitionId: string;
  status: WorkflowStatus;
  currentStepIds: string[];
  completedStepIds: string[];
  failedStepIds: string[];
  tasks: TaskRecord[];
  results: Record<string, any>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ─── SECURITY, PERMISSIONS & APPROVALS ──────────────────────────────────────

export interface AgentPermissions {
  allowedCapabilities: AgentCapability[];
  forbiddenCapabilities: AgentCapability[];
  canDeploy: boolean;
  canAccessSecrets: boolean;
  canRunDestructiveOps: boolean;
  maxWorkload: number;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  workflowId: string;
  agentDid: string;
  action: string;
  description: string;
  riskLevel: 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string; // Human operator nick or DID
  decisionReason?: string;
}

// ─── STRUCTURED AGENT MEMORY ────────────────────────────────────────────────

export type MemoryScope = 'task' | 'workflow' | 'agent' | 'team' | 'verified';

export interface MemoryEntry {
  scope: MemoryScope;
  namespace: string;
  key: string;
  value: any;
  version: number;
  timestamp: string;
  ownerDid: string;
  signature?: string;
}

// ─── OBSERVABILITY & EVENT STREAM ───────────────────────────────────────────

export type EventType =
  | 'WORKFLOW_CREATED'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_RETRYING'
  | 'RESULT_VERIFIED'
  | 'RESULT_REJECTED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_DECIDED'
  | 'SECURITY_ALERT'
  | 'AGENT_REGISTERED'
  | 'AGENT_HEARTBEAT'
  | 'MEMORY_WRITTEN';

export interface OrchestratorEvent {
  id: string;
  seq: number;
  type: EventType;
  timestamp: string;
  workflowId?: string;
  taskId?: string;
  agentDid?: string;
  actorDid?: string;
  payload: any;
  signature?: string;
}

// ─── AI PROVIDER ABSTRACTION ────────────────────────────────────────────────

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
  responseFormat?: 'text' | 'json';
}

export interface AIChatResponse {
  text: string;
  parsedJson?: any;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIPlanStep {
  stepId: string;
  title: string;
  role: AgentRole;
  requiredCapabilities: AgentCapability[];
  instruction: string;
  dependsOn: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  requiresHumanApproval?: boolean;
}

export interface AIPlanOutput {
  planTitle: string;
  summary: string;
  steps: AIPlanStep[];
}

export interface AIProvider {
  readonly name: string;
  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResponse>;
  createPlan(goal: string, context?: Record<string, any>): Promise<AIPlanOutput>;
  reviewResult(taskInput: any, agentOutput: any, role: AgentRole): Promise<{ approved: boolean; score: number; feedback: string }>;
}
