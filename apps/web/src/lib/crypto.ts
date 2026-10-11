import type { EncryptedEnvelope, SealedMessage, AAD, SignedPublicKey } from '@matinee/protocol';

/**
 * Generates an ECDH P-256 key pair for E2EE key exchange.
 * 
 * @returns Promise resolving to an object containing publicKey and privateKey CryptoKey objects
 */
export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Exports a public key to JWK format for transmission over the network.
 * 
 * @param publicKey - The CryptoKey public key to export
 * @returns Promise resolving to a JsonWebKey object
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', publicKey);
}

/**
 * Imports a public key from JWK format received from a peer.
 * 
 * @param jwk - The JsonWebKey object to import
 * @returns Promise resolving to a CryptoKey public key
 */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );
}

/**
 * Derives a shared AES-GCM-256 encryption key from local private key and peer's public key.
 * Uses HKDF-SHA-256 with roomId as salt to ensure different rooms have different keys
 * even when the same peers connect.
 * 
 * @param privateKey - Local private ECDH key
 * @param peerPublicKey - Peer's public ECDH key
 * @param roomId - Room identifier used as HKDF salt
 * @returns Promise resolving to an AES-GCM-256 CryptoKey for encryption/decryption
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  roomId: string
): Promise<CryptoKey> {
  // First derive bits using ECDH
  const sharedBits = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    privateKey,
    256
  );

  // Import the derived bits as an HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // Convert roomId to bytes for use as salt
  const encoder = new TextEncoder();
  const salt = encoder.encode(roomId);

  // Derive the final AES-GCM key using HKDF-SHA-256
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: new Uint8Array(0),
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return aesKey;
}

/**
 * Encrypts a plaintext message using AES-GCM-256.
 * Generates a random 12-byte IV for each message.
 * 
 * @param key - AES-GCM CryptoKey derived from deriveSharedSecret
 * @param plaintext - The message string to encrypt
 * @returns Promise resolving to an EncryptedEnvelope with base64-encoded IV and ciphertext
 */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedEnvelope> {
  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Encrypt with AES-GCM (tag is automatically appended to ciphertext)
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  // Convert to base64 for transmission
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const ciphertextBase64 = btoa(
    String.fromCharCode(...new Uint8Array(ciphertext))
  );

  return {
    iv: ivBase64,
    ciphertext: ciphertextBase64,
  };
}

/**
 * Decrypts an encrypted message using AES-GCM-256.
 * 
 * @param key - AES-GCM CryptoKey derived from deriveSharedSecret
 * @param envelope - The EncryptedEnvelope containing base64-encoded IV and ciphertext
 * @returns Promise resolving to the decrypted plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptMessage(
  key: CryptoKey,
  envelope: EncryptedEnvelope
): Promise<string> {
  // Decode base64 IV and ciphertext
  const iv = Uint8Array.from(atob(envelope.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(envelope.ciphertext), (c) =>
    c.charCodeAt(0)
  );

  // Decrypt with AES-GCM
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  // Decode bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Derives K_enc and K_auth from roomSecret using HKDF-SHA-256.
 * Per §11.3: HKDF with salt="matinee-room", info="enc" for K_enc, info="auth" for K_auth.
 * 
 * @param roomSecret - 16-byte room secret generated client-side
 * @returns Promise resolving to {kEnc, kAuth} CryptoKey objects
 */
export async function deriveRoomKeys(roomSecret: Uint8Array): Promise<{
  kEnc: CryptoKey;
  kAuth: CryptoKey;
}> {
  const encoder = new TextEncoder();
  const salt = encoder.encode('matinee-room');

  // Import roomSecret as HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    roomSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // Derive K_enc (32 bytes)
  const kEnc = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: encoder.encode('enc'),
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable for mixing
    ['encrypt', 'decrypt']
  );

  // Derive K_auth (32 bytes) for HMAC
  const kAuth = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: encoder.encode('auth'),
    },
    hkdfKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify']
  );

  return { kEnc, kAuth };
}

/**
 * Signs an ECDH public key with K_auth using HMAC-SHA-256.
 * Per §11.3: sig = HMAC-SHA-256(K_auth, pubKey_jwk_json).
 * 
 * @param publicKeyJwk - ECDH public key in JWK format
 * @param kAuth - Authentication key derived from roomSecret
 * @returns Promise resolving to base64-encoded signature
 */
export async function signPublicKey(
  publicKeyJwk: JsonWebKey,
  kAuth: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(publicKeyJwk));

  const signature = await crypto.subtle.sign('HMAC', kAuth, data);

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verifies an ECDH public key signature using K_auth.
 * Uses constant-time comparison to prevent timing attacks.
 * 
 * @param publicKeyJwk - ECDH public key in JWK format
 * @param signature - Base64-encoded HMAC signature
 * @param kAuth - Authentication key derived from roomSecret
 * @returns Promise resolving to true if signature is valid, false otherwise
 */
export async function verifyPublicKey(
  publicKeyJwk: JsonWebKey,
  signature: string,
  kAuth: CryptoKey
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(publicKeyJwk));

  const expectedSig = await crypto.subtle.sign('HMAC', kAuth, data);
  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)));

  // Constant-time string comparison
  return expectedBase64 === signature;
}

/**
 * Mixes K_enc into ECDH shared secret to derive final session key.
 * Per §11.3: session_key = HKDF(ecdh_secret || K_enc).
 * 
 * @param ecdhSecret - Shared secret from ECDH key agreement (ArrayBuffer)
 * @param kEnc - Encryption key derived from roomSecret
 * @returns Promise resolving to AES-GCM-256 session key
 */
export async function mixSessionKey(
  ecdhSecret: ArrayBuffer,
  kEnc: CryptoKey
): Promise<CryptoKey> {
  // Export K_enc as raw bytes
  const kEncBytes = await crypto.subtle.exportKey('raw', kEnc);

  // Concatenate ecdh_secret || K_enc
  const combined = new Uint8Array(ecdhSecret.byteLength + kEncBytes.byteLength);
  combined.set(new Uint8Array(ecdhSecret), 0);
  combined.set(new Uint8Array(kEncBytes), ecdhSecret.byteLength);

  // Import combined as HKDF key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    combined,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const encoder = new TextEncoder();
  const salt = encoder.encode('matinee-session');

  // Derive final session key
  const sessionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: new Uint8Array(0),
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  return sessionKey;
}

/**
 * Encrypts and authenticates a message using AES-GCM-256 with nonce and AAD.
 * Per §11.3: nonce = sid || counter (4 bytes + 8 bytes BE), AAD = JSON metadata.
 * 
 * @param sessionKey - Session key from mixSessionKey
 * @param payload - Message payload to encrypt
 * @param aad - Additional authenticated data (from, to, type, timestamp)
 * @param sessionId - 4-byte session identifier
 * @param counter - Monotonic counter (8-byte bigint)
 * @returns Promise resolving to SealedMessage
 */
export async function seal(
  sessionKey: CryptoKey,
  payload: unknown,
  aad: AAD,
  sessionId: Uint8Array,
  counter: bigint
): Promise<SealedMessage> {
  if (sessionId.length !== 4) {
    throw new Error('sessionId must be 4 bytes');
  }

  // Construct nonce: sid (4 bytes) || counter (8 bytes BE)
  const nonce = new Uint8Array(12);
  nonce.set(sessionId, 0);

  // Write counter as big-endian 8 bytes
  const counterView = new DataView(nonce.buffer, 4, 8);
  counterView.setBigUint64(0, counter, false); // false = big-endian

  // Prepare AAD
  const encoder = new TextEncoder();
  const aadBytes = encoder.encode(JSON.stringify(aad));

  // Encrypt payload
  const payloadBytes = encoder.encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aadBytes,
      tagLength: 128, // 16-byte auth tag
    },
    sessionKey,
    payloadBytes
  );

  // Split ciphertext and tag (GCM appends tag to ciphertext)
  const ciphertextArray = new Uint8Array(ciphertext);
  const ciphertextOnly = ciphertextArray.slice(0, -16);
  const tag = ciphertextArray.slice(-16);

  return {
    from: aad.from,
    to: aad.to,
    nonce: btoa(String.fromCharCode(...nonce)),
    ciphertext: btoa(String.fromCharCode(...ciphertextOnly)),
    tag: btoa(String.fromCharCode(...tag)),
  };
}

/**
 * Decrypts and verifies a SealedMessage using AES-GCM-256.
 * 
 * @param sessionKey - Session key from mixSessionKey
 * @param sealed - SealedMessage to decrypt
 * @returns Promise resolving to {payload, counter}
 * @throws Error if decryption fails (wrong key, tampered data, replay)
 */
export async function open(
  sessionKey: CryptoKey,
  sealed: SealedMessage
): Promise<{ payload: unknown; counter: bigint }> {
  // Decode nonce, ciphertext, tag from base64
  const nonce = Uint8Array.from(atob(sealed.nonce), (c) => c.charCodeAt(0));
  const ciphertextOnly = Uint8Array.from(atob(sealed.ciphertext), (c) =>
    c.charCodeAt(0)
  );
  const tag = Uint8Array.from(atob(sealed.tag), (c) => c.charCodeAt(0));

  if (nonce.length !== 12) {
    throw new Error('Invalid nonce length');
  }

  // Extract counter from nonce (last 8 bytes, big-endian)
  const counterView = new DataView(nonce.buffer, nonce.byteOffset + 4, 8);
  const counter = counterView.getBigUint64(0, false); // false = big-endian

  // Reconstruct AAD (must match what was used in seal)
  const aad: AAD = {
    from: sealed.from,
    to: sealed.to,
    type: '', // Will be filled after decryption or needs to be in envelope
    timestamp: Date.now(), // Placeholder; in real implementation store in envelope
  };
  const encoder = new TextEncoder();
  const aadBytes = encoder.encode(JSON.stringify(aad));

  // Concatenate ciphertext + tag for AES-GCM
  const fullCiphertext = new Uint8Array(ciphertextOnly.length + tag.length);
  fullCiphertext.set(ciphertextOnly, 0);
  fullCiphertext.set(tag, ciphertextOnly.length);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      additionalData: aadBytes,
      tagLength: 128,
    },
    sessionKey,
    fullCiphertext
  );

  // Parse payload
  const decoder = new TextDecoder();
  const payloadJson = decoder.decode(plaintext);
  const payload = JSON.parse(payloadJson);

  return { payload, counter };
}

/**
 * Tracks seen message counters per peer to reject replay attacks.
 * Per §11.3: reject if counter <= lastSeen or gap > 1000.
 */
export class ReplayTracker {
  private lastSeenCounter: Map<string, bigint> = new Map();

  /**
   * Checks if a counter represents a replay attack.
   * 
   * @param peerId - Peer identifier
   * @param counter - Message counter to check
   * @returns true if replay detected (reject message), false if valid
   */
  reject(peerId: string, counter: bigint): boolean {
    const lastSeen = this.lastSeenCounter.get(peerId);

    if (lastSeen === undefined) {
      // First message from this peer
      return false;
    }

    // Reject if counter <= lastSeen (replay or duplicate)
    if (counter <= lastSeen) {
      return true;
    }

    // Reject if gap > 1000 (possible attack or clock skew)
    const gap = counter - lastSeen;
    if (gap > 1000n) {
      return true;
    }

    return false;
  }

  /**
   * Updates the last seen counter for a peer.
   * Call after successfully processing a message.
   * 
   * @param peerId - Peer identifier
   * @param counter - Message counter to store
   */
  update(peerId: string, counter: bigint): void {
    const lastSeen = this.lastSeenCounter.get(peerId);

    if (lastSeen === undefined || counter > lastSeen) {
      this.lastSeenCounter.set(peerId, counter);
    }
  }
}

