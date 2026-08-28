/**
 * Technocore Agent Kit — Identity Storage
 * Secure filesystem persistence with automated gitignore protection.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentIdentity, loadAgentIdentity } from './identity.js';

export interface StorageOptions {
  filePath?: string;
  autoGitignore?: boolean;
}

const DEFAULT_SECRET_FILENAME = '.agent-identity.json';

/**
 * Ensures that the secret key file path is added to .gitignore
 */
export function ensureGitignore(secretPath: string, rootDir: string = process.cwd()): void {
  try {
    const gitignorePath = path.join(rootDir, '.gitignore');
    const relativeSecret = path.relative(rootDir, secretPath).replace(/\\/g, '/');
    const entry = relativeSecret.startsWith('.') ? relativeSecret : `./${relativeSecret}`;

    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8');
      if (content.includes(relativeSecret) || content.includes(path.basename(secretPath))) {
        return; // Already protected
      }
    }

    const addition = `\n# Technocore Agent Secret Key (Protected)\n${entry}\n*.secret\n*.priv\nagent-identity.json\n.agent-identity.json\n`;
    fs.appendFileSync(gitignorePath, addition, 'utf8');
  } catch {
    // Non-fatal if gitignore cannot be modified
  }
}

/**
 * Saves an AgentIdentity to a secure local file (0600 permissions)
 */
export function saveIdentityToFile(identity: AgentIdentity, options: StorageOptions = {}): string {
  const targetPath = options.filePath || path.join(process.cwd(), DEFAULT_SECRET_FILENAME);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const secretHex = Buffer.from(identity.getPrivateKeyBytes()).toString('hex');
  const payload = {
    _security_warning: 'DO NOT COMMIT OR SHARE THIS FILE. Contains private Ed25519 key material.',
    did: identity.did,
    fingerprint: identity.fingerprint,
    shard: identity.shard,
    key: identity.key,
    secret_seed_hex: secretHex,
    created_at: new Date().toISOString(),
    author: 'Asad Lee (Technocore Agent Kit)',
  };

  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });

  if (options.autoGitignore !== false) {
    ensureGitignore(targetPath);
  }

  return targetPath;
}

/**
 * Loads an AgentIdentity from a secure local file
 */
export function loadIdentityFromFile(filePath?: string): AgentIdentity {
  const targetPath = filePath || path.join(process.cwd(), DEFAULT_SECRET_FILENAME);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Agent identity file not found at: ${targetPath}`);
  }

  const raw = fs.readFileSync(targetPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed.secret_seed_hex) {
    throw new Error(`Invalid identity file format at: ${targetPath}. Missing 'secret_seed_hex'.`);
  }

  return loadAgentIdentity(parsed.secret_seed_hex);
}
