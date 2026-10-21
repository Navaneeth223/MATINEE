import { describe, it, expect } from 'vitest';
import { buildInviteLink, parseInviteFragment } from './invite';

describe('invite links', () => {
  it('16 bytes -> 22 chars', () => {
    const secret = new Uint8Array(16);
    crypto.getRandomValues(secret);
    const link = buildInviteLink('https://example.com', 'abc123', secret);
    
    const hashPart = link.split('#k=')[1];
    expect(hashPart).toBeDefined();
    expect(hashPart!.length).toBe(22);
  });

  it('round-trip equals', () => {
    const secret = new Uint8Array(16);
    crypto.getRandomValues(secret);
    const link = buildInviteLink('https://example.com', 'test', secret);
    
    const fragment = '#' + link.split('#')[1];
    const parsed = parseInviteFragment(fragment);
    
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(secret);
  });

  it('wrong length rejected', () => {
    const secret32 = new Uint8Array(32);
    expect(() => buildInviteLink('https://example.com', 'test', secret32)).toThrow('16 bytes');
    
    // Parse rejects 32-byte secret (43 chars base64url)
    const parsed = parseInviteFragment('#k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(parsed).toBeNull();
  });
});
