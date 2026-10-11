import { describe, it, expect } from 'vitest';
import { generateSAS, generateECDHKeyPair } from './crypto';

describe('generateSAS (§11.3)', () => {
  it('produces different words for different session public keys', async () => {
    const roomId = 'test-room-001';
    
    // Peer A generates ECDH key pair
    const keyPairA = await generateECDHKeyPair();
    const pubKeyA = await crypto.subtle.exportKey('jwk', keyPairA.publicKey);
    
    // Peer B generates ECDH key pair
    const keyPairB = await generateECDHKeyPair();
    const pubKeyB = await crypto.subtle.exportKey('jwk', keyPairB.publicKey);
    
    // Both compute SAS from their perspective (local vs remote swapped)
    const sasA = await generateSAS(pubKeyA, pubKeyB, roomId);
    const sasB = await generateSAS(pubKeyB, pubKeyA, roomId);
    
    // Both peers should see the SAME words (keys are sorted inside generateSAS)
    expect(sasA).toEqual(sasB);
    expect(sasA).toHaveLength(4);
    
    // Now test with a different pair - should produce different words
    const keyPairC = await generateECDHKeyPair();
    const pubKeyC = await crypto.subtle.exportKey('jwk', keyPairC.publicKey);
    
    const sasAC = await generateSAS(pubKeyA, pubKeyC, roomId);
    
    // Different session keys → different SAS (MITM detection)
    expect(sasAC).not.toEqual(sasA);
    expect(sasAC).toHaveLength(4);
  });
  
  it('produces the same words regardless of key order (deterministic)', async () => {
    const roomId = 'test-room-002';
    
    const keyPairA = await generateECDHKeyPair();
    const pubKeyA = await crypto.subtle.exportKey('jwk', keyPairA.publicKey);
    
    const keyPairB = await generateECDHKeyPair();
    const pubKeyB = await crypto.subtle.exportKey('jwk', keyPairB.publicKey);
    
    // Both peers compute with keys in their own order
    const sasAB = await generateSAS(pubKeyA, pubKeyB, roomId);
    const sasBA = await generateSAS(pubKeyB, pubKeyA, roomId);
    
    // Must be identical (internal sorting ensures this)
    expect(sasAB).toEqual(sasBA);
  });
  
  it('produces different words for different roomIds', async () => {
    const keyPairA = await generateECDHKeyPair();
    const pubKeyA = await crypto.subtle.exportKey('jwk', keyPairA.publicKey);
    
    const keyPairB = await generateECDHKeyPair();
    const pubKeyB = await crypto.subtle.exportKey('jwk', keyPairB.publicKey);
    
    const sas1 = await generateSAS(pubKeyA, pubKeyB, 'room-001');
    const sas2 = await generateSAS(pubKeyA, pubKeyB, 'room-002');
    
    // Different roomId → different SAS (prevents key reuse attacks)
    expect(sas1).not.toEqual(sas2);
  });
});
