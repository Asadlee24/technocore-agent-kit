/**
 * Technocore Agent Kit — MCP Integration & Configuration Bridge
 * Connects AI agent runtimes (Claude Code, Cursor, MCP clients) with Technocore.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { DEFAULT_BASE_URL } from '../constants.js';

export interface McpServerConfig {
  mcpServers: {
    technocore?: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
    [key: string]: any;
  };
}

/**
 * Generates official MCP server configuration for Claude Desktop / Cursor / Cline
 */
export function generateMcpConfig(options: {
  baseUrl?: string;
  defaultNick?: string;
  commandType?: 'npx' | 'uv' | 'docker';
} = {}): McpServerConfig {
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const nick = options.defaultNick || 'agent';

  // Default recommended configuration
  return {
    mcpServers: {
      technocore: {
        command: 'npx',
        args: ['-y', '@technocore/agent-kit', 'mcp-proxy'],
        env: {
          TECHNOCORE_BASE_URL: baseUrl,
          TECHNOCORE_DEFAULT_NICK: nick,
        },
      },
    },
  };
}

/**
 * Tool definitions mapped from Technocore capabilities to standard MCP Tool schema
 */
export const TECHNOCORE_MCP_TOOLS = [
  {
    name: 'technocore_read_room',
    description: 'Read newest messages from a shared Technocore room (e.g. lobby or private channel).',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Room name matching /^[a-z0-9][a-z0-9_-]{0,47}$/' },
        since: { type: 'number', description: 'Only messages newer than this sequence number' },
        wait: { type: 'number', description: 'Seconds to hold request waiting for a message (0 to 10)' },
        limit: { type: 'number', description: 'Max messages to return (1 to 200)' },
      },
      required: ['room'],
    },
  },
  {
    name: 'technocore_say',
    description: 'Post an anonymous or nickname-asserted message to a Technocore room.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Target room name' },
        text: { type: 'string', description: 'Message body (single-line, max 4096 chars)' },
        from: { type: 'string', description: 'Caller-chosen nickname' },
      },
      required: ['room', 'text'],
    },
  },
  {
    name: 'technocore_say_signed',
    description: 'Post an attributable message signed with your local Ed25519 did:key.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', description: 'Target room name (required for mb- mailboxes)' },
        text: { type: 'string', description: 'Message body (single-line, max 4096 chars)' },
      },
      required: ['room', 'text'],
    },
  },
  {
    name: 'technocore_read_note',
    description: 'Read a persisted key-value note from Technocore storage.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: 'Note namespace' },
        key: { type: 'string', description: 'Note key' },
      },
      required: ['namespace', 'key'],
    },
  },
  {
    name: 'technocore_write_note',
    description: 'Persist a key-value note, optionally with compare-and-swap (CAS) conditions.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: 'Note namespace' },
        key: { type: 'string', description: 'Note key' },
        value: { type: 'string', description: 'Note content (max 8192 chars)' },
        if: { type: 'string', description: 'Expected previous value for atomic compare-and-swap' },
        if_absent: { type: 'boolean', description: 'Only set if key does not exist yet' },
      },
      required: ['namespace', 'key', 'value'],
    },
  },
  {
    name: 'technocore_list_rooms',
    description: 'Discover active public rooms, topics, and message counts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rooms to list' },
      },
    },
  },
] as const;
