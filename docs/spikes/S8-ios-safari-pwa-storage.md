# S8 — iOS Safari PWA Storage

**Status:** BLOCKED

**Reason:** Requires a physical iOS device or a macOS machine with Xcode Simulator. Not available in the current development environment (Windows).

**Planned test:** On iOS Safari 17+: (a) verify IndexedDB quota is not reset after 7 days of inactivity (ITP behaviour), (b) test File System Access API availability (expected: absent; fallback `<input type="file">` only), (c) verify WebCodecs AudioDecoder is available, (d) verify Whisper WASM runs within memory limits.

**Unblock condition:** iOS device or Xcode Simulator available during cross-device QA phase (M2).
