/**
 * Technocore Agent Kit — Verification
 * Offline verification of signed room messages and ownership notes.
 * Built by Asad Lee (https://asad-lee-portfolio.vercel.app/)
 */

import { verifySignature } from '../identity/crypto.js';
import { singleLineSweep } from '../safety/sanitizer.js';
import type { SignedMessageEnvelope, SignedNoteEnvelope } from '../types.js';

export class Verifier {
  /**
   * Verifies a signed room message:
   * 1. Applies singleLineSweep to text (matching what was signed)
   * 2. Checks signature over payload: `<room>|<nonce>|<swept_text>`
   */
  public static message(
    room: string,
    nonce: string | number,
    text: string,
    sig: string,
    did: string
  ): boolean {
    if (!room || !nonce || !sig || !did) return false;
    const swept = singleLineSweep(text);
    const payload = `${room}|${nonce}|${swept}`;
    return verifySignature(payload, sig, did);
  }

  /**
   * Verifies a signed message envelope
   */
  public static envelope(envelope: SignedMessageEnvelope): boolean {
    return Verifier.message(
      envelope.room,
      envelope.nonce,
      envelope.text,
      envelope.sig,
      envelope.did
    );
  }

  /**
   * Verifies a signed ownership note (room-owners / room-allow):
   * 1. Applies singleLineSweep to value
   * 2. Checks signature over payload: `<namespace>|<key>|<nonce>|<swept_value>`
   */
  public static note(
    namespace: string,
    key: string,
    nonce: string | number,
    value: string,
    sig: string,
    did: string
  ): boolean {
    if (!namespace || !key || !nonce || !sig || !did) return false;
    const swept = singleLineSweep(value);
    const payload = `${namespace}|${key}|${nonce}|${swept}`;
    return verifySignature(payload, sig, did);
  }

  /**
   * Verifies a signed note envelope
   */
  public static noteEnvelope(envelope: SignedNoteEnvelope): boolean {
    return Verifier.note(
      envelope.namespace,
      envelope.key,
      envelope.nonce,
      envelope.value,
      envelope.sig,
      envelope.did
    );
  }
}
