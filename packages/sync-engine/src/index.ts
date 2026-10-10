import type { AnchorTime, DriftReport, PlaybackState, ScheduledCommand } from '@matinee/protocol';

export interface DriftController {
  report(drift: DriftReport): void;
  getAdjustment(): number;
  reset(): void;
}

export interface SyncEngineConfig {
  politeRole: boolean;
  maxDriftMs: number;
}

export class NullDriftController implements DriftController {
  report(_drift: DriftReport): void {
    // Stub implementation
  }

  getAdjustment(): number {
    return 0;
  }

  reset(): void {
    // Stub implementation
  }
}

export function createSyncConfig(polite: boolean): SyncEngineConfig {
  return {
    politeRole: polite,
    maxDriftMs: 100,
  };
}

// Re-export anchor time utilities
export function measureDrift(anchor: AnchorTime, currentMediaTime: number): number {
  const elapsedWallMs = Date.now() - anchor.wallClock;
  const expectedMediaTime = anchor.mediaTime + elapsedWallMs / 1000;
  return currentMediaTime - expectedMediaTime;
}

// Re-export types from protocol for convenience
export type { AnchorTime, DriftReport, PlaybackState, ScheduledCommand };
