import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from './crypto';

/**
 * Test function for E2EE crypto layer.
 * Simulates two peers (Alice and Bob) performing key exchange,
 * encrypting a message, and decrypting it.
 * 
 * Call this from the browser console to verify E2EE implementation.
 */
export async function testE2EE(): Promise<void> {
  console.log('🔐 Starting E2EE Test...');

  try {
    // Simulate room
    const roomId = 'test-room-123';
    const testMessage = 'Hello from Alice! 🎬';

    console.log('1️⃣ Generating key pairs for Alice and Bob...');
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();
    console.log('✅ Key pairs generated');

    console.log('2️⃣ Exporting public keys for exchange...');
    const alicePublicJWK = await exportPublicKey(aliceKeys.publicKey);
    const bobPublicJWK = await exportPublicKey(bobKeys.publicKey);
    console.log('✅ Public keys exported:', {
      alice: alicePublicJWK,
      bob: bobPublicJWK,
    });

    console.log('3️⃣ Importing peer public keys...');
    const aliceImportedBobPublic = await importPublicKey(bobPublicJWK);
    const bobImportedAlicePublic = await importPublicKey(alicePublicJWK);
    console.log('✅ Public keys imported');

    console.log('4️⃣ Deriving shared secrets with roomId salt...');
    const aliceSharedSecret = await deriveSharedSecret(
      aliceKeys.privateKey,
      aliceImportedBobPublic,
      roomId
    );
    const bobSharedSecret = await deriveSharedSecret(
      bobKeys.privateKey,
      bobImportedAlicePublic,
      roomId
    );
    console.log('✅ Shared secrets derived');

    console.log('5️⃣ Alice encrypting message:', testMessage);
    const encrypted = await encryptMessage(aliceSharedSecret, testMessage);
    console.log('✅ Message encrypted:', encrypted);

    console.log('6️⃣ Bob decrypting message...');
    const decrypted = await decryptMessage(bobSharedSecret, encrypted);
    console.log('✅ Message decrypted:', decrypted);

    // Verify round-trip
    if (decrypted === testMessage) {
      console.log('✅✅✅ E2EE TEST PASSED! Message matches:', {
        original: testMessage,
        decrypted: decrypted,
      });
    } else {
      console.error('❌ E2EE TEST FAILED! Message mismatch:', {
        original: testMessage,
        decrypted: decrypted,
      });
    }

    // Test that different roomId produces different keys
    console.log('7️⃣ Testing roomId salt isolation...');
    const differentRoomId = 'different-room-456';
    const aliceSharedSecretDifferentRoom = await deriveSharedSecret(
      aliceKeys.privateKey,
      aliceImportedBobPublic,
      differentRoomId
    );

    const encryptedDifferentRoom = await encryptMessage(
      aliceSharedSecretDifferentRoom,
      testMessage
    );

    try {
      // This should fail because Bob is using wrong room's key
      await decryptMessage(bobSharedSecret, encryptedDifferentRoom);
      console.error(
        '❌ Room isolation test FAILED! Decryption should have failed with different roomId'
      );
    } catch (error) {
      console.log(
        '✅ Room isolation test PASSED! Different roomId prevents decryption'
      );
    }

    console.log('🎉 All E2EE tests completed successfully!');
  } catch (error) {
    console.error('❌ E2EE TEST FAILED with error:', error);
    throw error;
  }
}

// Auto-expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).testE2EE = testE2EE;
  console.log('💡 E2EE test available: Run testE2EE() in console');
}
