import type { EncryptedEnvelope } from '@matinee/protocol';

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
