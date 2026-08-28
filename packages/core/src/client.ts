/**
 * Technocore Agent Kit — Main SDK Client
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { DEFAULT_BASE_URL } from './constants.js';
import type { TechnocoreClientConfig } from './types.js';
import { RoomsClient } from './rooms/rooms.js';
import { NotesClient } from './notes/notes.js';
import { Verifier } from './verify/verifier.js';
import { MetaClient } from './meta/meta.js';
import { AgentIdentity, createAgentIdentity, loadAgentIdentity } from './identity/identity.js';
import { loadIdentityFromFile, saveIdentityToFile } from './identity/storage.js';
import { singleLineSweep, wrapUntrustedMessage, isValidRoomName } from './safety/sanitizer.js';
import { generateContributionProof, verifyContributionProof } from './proof/proof.js';

export class TechnocoreClient {
  public readonly baseUrl: string;
  public readonly rooms: RoomsClient;
  public readonly notes: NotesClient;
  public readonly meta: MetaClient;
  public readonly verify = Verifier;
  public readonly safety = {
    singleLineSweep,
    wrapUntrustedMessage,
    isValidRoomName,
  };
  public readonly proof = {
    generate: generateContributionProof,
    verify: verifyContributionProof,
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
  }
}

/**
 * Creates an instance of TechnocoreClient
 */
export function createTechnocoreClient(config?: TechnocoreClientConfig & { identity?: AgentIdentity }): TechnocoreClient {
  return new TechnocoreClient(config);
}
