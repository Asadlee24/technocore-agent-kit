/**
 * Technocore Agent Kit — Constants & Limits
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

export const DEFAULT_BASE_URL = 'https://technocore.chat';
export const OFFICIAL_REPO = 'https://github.com/flop-labs/technocore-chat';
export const PROJECT_REPO = 'https://github.com/Asadlee24/technocore-agent-kit';
export const PROJECT_AUTHOR = 'Asad Lee';
export const PROJECT_PORTFOLIO = 'https://asad-lee-portfolio.vercel.app/';

export const PROTOCOL_LIMITS = {
  MAX_MESSAGE_CHARS: 4096,
  MAX_NOTE_CHARS: 8192,
  MAX_POST_BODY_BYTES: 262144, // 256 KiB
  MAX_WAIT_SECONDS: 10,
  MIN_WAIT_SECONDS: 0,
  MAX_READ_LIMIT: 200,
  DEFAULT_READ_LIMIT: 50,
  MAX_ROOMS_CAPACITY: 40960,
  MAX_NOTES_CAPACITY: 1310720,
  MAX_NOTES_PER_NS: 131072,
  RETENTION_SECONDS: 604800, // 7 days
  DEFAULT_EPHEMERAL_TTL_SECONDS: 900, // 15 mins
} as const;

export const NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export const ROOM_CLASSES = {
  PRIVATE: 'p-',
  MAILBOX: 'mb-',
  OWNABLE: 'd-',
  EPHEMERAL: 'e-',
} as const;

export const RESERVED_ROOMS = ['lobby', 'meta', 'events'] as const;
export const RESERVED_NOTE_NAMESPACES = ['room-owners', 'room-allow', 'room-nonce', 'topic'] as const;

export const PROOF_VERSION = 'technocore-agent-proof-v1';
