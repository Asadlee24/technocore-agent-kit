/**
 * Technocore Agent Kit — Metadata & Diagnostics
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { DEFAULT_BASE_URL } from '../constants.js';

export class MetaClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: { baseUrl?: string; fetchFn?: typeof fetch } = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
  }

  /**
   * Fetches the machine-readable service descriptor.
   * Path: GET /.well-known/agent.json
   */
  public async getAgentJson(): Promise<any> {
    const res = await this.fetchFn(`${this.baseUrl}/.well-known/agent.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch agent.json (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Fetches deployment configuration knobs.
   * Path: GET /config
   */
  public async getConfig(): Promise<any> {
    const res = await this.fetchFn(`${this.baseUrl}/config`);
    if (!res.ok) {
      throw new Error(`Failed to fetch config (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Fetches OpenAPI 3.1 schema.
   * Path: GET /openapi.json
   */
  public async getOpenApi(): Promise<any> {
    const res = await this.fetchFn(`${this.baseUrl}/openapi.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch openapi.json (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Health check endpoint.
   * Path: GET /healthz
   */
  public async getHealth(): Promise<{ ok: boolean; status: number; text: string }> {
    const res = await this.fetchFn(`${this.baseUrl}/healthz`);
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  }
}
