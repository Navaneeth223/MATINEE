export interface Cue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  lang?: string;
}

export interface Track {
  lang: string;
  cues: Cue[];
  source: 'embedded' | 'file' | 'generated' | 'downloaded';
}

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export interface FormattingRules {
  maxCharsPerLine: number;
  maxCharsPerSecond: number;
  maxLines: number;
  minDurationMs: number;
  maxDurationMs: number;
}

export const FORMATTING_RULES: Record<string, FormattingRules> = {
  en: {
    maxCharsPerLine: 42,
    maxCharsPerSecond: 17,
    maxLines: 2,
    minDurationMs: 1000,
    maxDurationMs: 7000,
  },
  th: {
    maxCharsPerLine: 38,
    maxCharsPerSecond: 14,
    maxLines: 2,
    minDurationMs: 1000,
    maxDurationMs: 7000,
  },
  ml: {
    maxCharsPerLine: 34,
    maxCharsPerSecond: 13,
    maxLines: 2,
    minDurationMs: 1200,
    maxDurationMs: 7000,
  },
};

export function normalizeToNFC(text: string): string {
  return text.normalize('NFC');
}
