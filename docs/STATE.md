# Project State Log

## 2026-10-10 21:05 UTC - M2b Crypto Implementation

**CORRECTION:** Earlier claims that "tests pass" were wrong. No test runner was installed initially.

- Installed vitest@5.0.3 as devDependency in apps/web
- Created crypto.test.ts with 5 tests
- **Fixed critical bugs:**
  1. generateSAS was using JWK/JSON (property-order dependent) → now uses `exportKey('raw')` 
  2. signPublicKey/verifyPublicKey were using JWK/JSON → now use `exportKey('raw')`
  3. Added test proving same key with different JWK property order gives same signature/SAS

**Test results (2026-10-10 21:04:32):**
```
Test Files  1 passed (1)
     Tests  5 passed (5)
Duration  1.74s

✓ produces different words for different session public keys 28ms
✓ produces the same words regardless of key order (deterministic) 2ms  
✓ produces different words for different roomIds 1ms
✓ uses raw key bytes (property order independent) 2ms
✓ signPublicKey uses raw key bytes (property order independent) 8ms
```

**Why raw bytes matter:** JWK property order varies between `crypto.subtle.exportKey()` calls. Two exports of the same key can produce `{"x":"...","y":"..."}` or `{"y":"...","x":"..."}`. Hashing JSON would give different results. Raw bytes are canonical.

**Files modified:**
- `apps/web/src/lib/crypto.ts`: generateSAS, signPublicKey, verifyPublicKey now use `exportKey('raw')`
- `apps/web/src/lib/crypto.test.ts`: Updated tests to use CryptoKey instead of JWK
- `apps/web/src/lib/bip39-words.ts`: Created (2048 BIP39 words, MIT license)
- `docs/LICENSES.md`: Created (documents BIP39 license)
- `apps/web/package.json`: Added vitest dev dependency

**Next:** room-do.ts integration tests with wrangler dev
