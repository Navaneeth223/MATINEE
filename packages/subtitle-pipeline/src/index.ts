import type { Track, Cue } from '@matinee/subtitle-core';

export type AudioExtractionMethod = 'webcodecs' | 'ffmpeg-wasm';

export interface ExtractionResult {
  method: AudioExtractionMethod;
  audioBuffer: ArrayBuffer;
  durationSec: number;
}

export interface PipelineOptions {
  lang: string;
  modelSize: 'tiny' | 'small' | 'medium';
  useWebGPU: boolean;
}

export interface TranslationProvider {
  name: string;
  translate(text: string, from: string, to: string): Promise<string>;
}

export interface SubtitlePipeline {
  extract(file: File, opts: PipelineOptions): Promise<Track>;
}

// Sentinel export for tree-shaking verification
export const PIPELINE_VERSION = '0.1.0';

// Re-export types from subtitle-core for convenience
export type { Track, Cue };
