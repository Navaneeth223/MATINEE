# Third-Party Licenses

This document records the licenses of third-party resources used in Matinee.

---

## BIP39 English Wordlist

**Source:** https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt  
**Specification:** BIP-0039 (Mnemonic code for generating deterministic keys)  
**License:** MIT  
**Copyright:** This BIP falls under the MIT License.

**Header from bip-0039.mediawiki:**
```
  BIP: 39
  Layer: Applications
  Title: Mnemonic code for generating deterministic keys
  Authors: Marek Palatinus <slush@satoshilabs.com>
           Pavol Rusnak <stick@satoshilabs.com>
           Aaron Voisine <voisine@gmail.com>
           Sean Bowe <ewillbefull@gmail.com>
  Status: Deployed
  Type: Specification
  Assigned: 2013-09-10
  License: MIT
```

**Usage in Matinee:** The 2,048-word English wordlist is used for Short Authentication String (SAS) generation in our E2EE room setup. Four words are displayed to both peers to verify they share the same session keys (§11.3).

**File:** `apps/web/src/lib/bip39-words.ts`

---

*Last updated: 2026-10-10*
