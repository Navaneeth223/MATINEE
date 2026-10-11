# ADR-001: SAS Format - 4 Words from 2048-Word List

**Date:** 2026-10-10  
**Status:** Accepted  
**Deciders:** Owner  
**Milestone:** M2b

## Context

Short Authentication String (SAS) is needed for users to verbally confirm they share the same room secret, detecting MITM attacks. The format must be:
- Easy to read aloud (cross-language)
- Easy to compare visually
- Sufficient entropy for MITM detection

## Decision

Use **4 words from a 2,048-word list** (BIP39-compatible wordlist).

- **Entropy:** 4 words × 11 bits = 44 bits (sufficient for MITM detection)
- **Example:** "army coach butter nephew"
- **Wordlist:** BIP39 English wordlist (2048 words, designed for international use)

## Consequences

### Enables
- Cross-language verification (BIP39 words are internationally recognizable)
- High usability (4 short words easy to read and compare)
- Sufficient security (2^44 possible combinations)

### Prevents
- Using 6-digit PIN (only 2^20 entropy, weaker)
- Using 6 words (overkill for room verification)

### Implementation
- Derive 44 bits from roomSecret using HKDF
- Map to 4 BIP39 words
- Display on both screens after key exchange complete
- Users verbally confirm match (optional but recommended)

## Alternatives Considered

1. **6-digit PIN** - Rejected: Only 2^20 entropy (1 million combinations), too weak
2. **6 BIP39 words** - Rejected: Overkill, harder to verify verbally
3. **No SAS** - Rejected: Violates security best practice for E2EE verification

## References

- BIP39 wordlist: https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt
- §11.3 of specification
