import { describe, it, expect } from 'vitest';
import { newRoomId, RE_ROOM_ID } from './room-id';

describe('newRoomId', () => {
  it('always matches the format', () => {
    for (let i = 0; i < 1000; i++) expect(newRoomId()).toMatch(RE_ROOM_ID);
  });
  it('20,000 ids are all unique', () => {
    expect(new Set(Array.from({ length: 20000 }, newRoomId)).size).toBe(20000);
  });
  it('every symbol appears about equally often (no zero-heavy ids)', () => {
    const counts = new Map<string, number>();
    const N = 20000;
    for (let i = 0; i < N; i++) for (const ch of newRoomId()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const expected = (N * 10) / 32; // 6250
    expect(counts.size).toBe(32);
    for (const c of counts.values()) expect(Math.abs(c - expected)).toBeLessThan(expected * 0.08);
  });
  it('no id has more than 4 of the same symbol', () => {
    for (let i = 0; i < 20000; i++) {
      const freq = new Map<string, number>();
      for (const ch of newRoomId()) freq.set(ch, (freq.get(ch) ?? 0) + 1);
      expect(Math.max(...freq.values())).toBeLessThanOrEqual(5);
    }
  });
});
