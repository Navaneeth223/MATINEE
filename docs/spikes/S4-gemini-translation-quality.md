# S4 — Gemini Translation Quality

**Status:** BLOCKED

**Reason:** Requires a Gemini API key. The project uses a BYOK model — each user supplies their own key at M3. No shared key is available in the development environment.

**Planned test:** At M3 setup, measure: (a) EN→TH WER on 50 representative subtitle cues, (b) EN→ML WER on same set, (c) latency per 100 cues for gemini-1.5-flash, (d) cost per 10,000 cues at current Gemini pricing.

**Unblock condition:** Owner provides a Gemini API key for testing at M3.
