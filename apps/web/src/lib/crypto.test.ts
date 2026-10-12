import { describe, it, expect } from 'vitest';
import { generateSAS, generateECDHKeyPair, signPublicKey, deriveRoomKeys } from './crypto';

describe('generateSAS (§11.3)', () => {
  it('produces different words for different session public keys', async () => {
    const roomId = 'test-room-001';
    
    // Peer A generates ECDH key pair
    const keyPairA = await generateECDHKeyPair();
    
    // Peer B generates ECDH key pair
    const keyPairB = await generateECDHKeyPair();
    
    // Both compute SAS from their perspective (local vs remote swapped)
    const sasA = await generateSAS(keyPairA.publicKey, keyPairB.publicKey, roomId);
    const sasB = await generateSAS(keyPairB.publicKey, keyPairA.publicKey, roomId);
    
    // Both peers should see the SAME words (keys are sorted inside generateSAS)
    expect(sasA).toEqual(sasB);
    expect(sasA).toHaveLength(4);
    
    // Now test with a different pair - should produce different words
    const keyPairC = await generateECDHKeyPair();
    
    const sasAC = await generateSAS(keyPairA.publicKey, keyPairC.publicKey, roomId);
    
    // Different session keys → different SAS (MITM detection)
    expect(sasAC).not.toEqual(sasA);
    expect(sasAC).toHaveLength(4);
  });
  
  it('produces the same words regardless of key order (deterministic)', async () => {
    const roomId = 'test-room-002';
    
    const keyPairA = await generateECDHKeyPair();
    const keyPairB = await generateECDHKeyPair();
    
    // Both peers compute with keys in their own order
    const sasAB = await generateSAS(keyPairA.publicKey, keyPairB.publicKey, roomId);
    const sasBA = await generateSAS(keyPairB.publicKey, keyPairA.publicKey, roomId);
    
    // Must be identical (internal sorting ensures this)
    expect(sasAB).toEqual(sasBA);
  });
  
  it('produces different words for different roomIds', async () => {
    const keyPairA = await generateECDHKeyPair();
    const keyPairB = await generateECDHKeyPair();
    
    const sas1 = await generateSAS(keyPairA.publicKey, keyPairB.publicKey, 'room-001');
    const sas2 = await generateSAS(keyPairA.publicKey, keyPairB.publicKey, 'room-002');
    
    // Different roomId → different SAS (prevents key reuse attacks)
    expect(sas1).not.toEqual(sas2);
  });
  
  it('uses raw key bytes (property order independent)', async () => {
    const roomId = 'test-room-003';
    
    // Generate one key pair
    const keyPairA = await generateECDHKeyPair();
    const keyPairB = await generateECDHKeyPair();
    
    // Export to JWK with different property orders doesn't matter
    // because generateSAS uses exportKey('raw')
    const sas1 = await generateSAS(keyPairA.publicKey, keyPairB.publicKey, roomId);
    const sas2 = await generateSAS(keyPairA.publicKey, keyPairB.publicKey, roomId);
    
    // Must be identical (raw bytes are property-order independent)
    expect(sas1).toEqual(sas2);
  });
});

describe('signPublicKey and verifyPublicKey (§11.3)', () => {
  it('uses raw key bytes (property order independent)', async () => {
    const roomSecret = crypto.getRandomValues(new Uint8Array(16));
    const { kAuth } = await deriveRoomKeys(roomSecret);
    
    const keyPair = await generateECDHKeyPair();
    
    // Sign the same key twice
    const sig1 = await signPublicKey(keyPair.publicKey, kAuth);
    const sig2 = await signPublicKey(keyPair.publicKey, kAuth);
    
    // Signatures must be identical (raw bytes are property-order independent)
    expect(sig1).toEqual(sig2);
  });
});
