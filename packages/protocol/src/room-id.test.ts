import { describe, it, expect } from 'vitest';
import { newRoomId, isValidRoomId } from './room-id';

describe('room-id', () => {
  describe('newRoomId', () => {
    it('generates 12-char string', () => {
      const id = newRoomId();
      expect(id).toHaveLength(12);
    });

    it('uses only safe alphabet', () => {
      const id = newRoomId();
      expect(isValidRoomId(id)).toBe(true);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(newRoomId());
      }
      expect(ids.size).toBe(1000);
    });

    it('no ambiguous characters (0,1,i,l,o)', () => {
      const id = newRoomId();
      expect(id).not.toMatch(/[01ilo]/);
    });
  });

  describe('isValidRoomId', () => {
    it('accepts valid 12-char ID', () => {
      expect(isValidRoomId('x7k3m9pq2wfn')).toBe(true);
    });

    it('rejects wrong length', () => {
      expect(isValidRoomId('abc')).toBe(false);
      expect(isValidRoomId('x7k3m9pq2wfnx')).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(isValidRoomId('x7k3m9pq2wf0')).toBe(false); // has '0'
      expect(isValidRoomId('x7k3m9pq2wfl')).toBe(false); // has 'l'
    });
  });
});
