# S10 — Mode C Volume Passthrough Test

**Status:** PENDING (Required before M4)

**Purpose:** Test whether lowering the owner's Windows system volume affects the audio level that the partner hears when using getDisplayMedia (Mode C: Screen Share).

## Test Plan

### Setup

1. Owner runs Windows laptop/PC
2. Owner plays a film in VLC (or browser video player)
3. Owner shares entire screen via `getDisplayMedia()` with audio
4. Partner receives the shared screen + audio stream on MacBook

### Test Procedure

1. **Baseline:** Owner sets Windows volume to 100%; partner records received audio level
2. **Test 1:** Owner lowers Windows volume to 50%; partner records received audio level
3. **Test 2:** Owner lowers Windows volume to 20%; partner records received audio level
4. **Test 3:** Owner mutes Windows system audio; partner records received audio level

### Measurement

Partner uses Web Audio API `AnalyserNode` to measure RMS audio level in dB:

```javascript
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(remoteStream);
const analyser = audioContext.createAnalyser();
source.connect(analyser);

const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteTimeDomainData(dataArray);

// Calculate RMS level
let sum = 0;
for (let i = 0; i < dataArray.length; i++) {
  const normalized = (dataArray[i] - 128) / 128;
  sum += normalized * normalized;
}
const rms = Math.sqrt(sum / dataArray.length);
const db = 20 * Math.log10(rms);
console.log(`Received audio level: ${db.toFixed(2)} dB`);
```

### Expected Outcomes

**Hypothesis A:** Windows volume DOES affect captured audio
- 100% volume → baseline dB
- 50% volume → ~-6 dB (half amplitude)
- 20% volume → ~-14 dB
- Muted → -∞ dB (silence)

**Hypothesis B:** Windows volume does NOT affect captured audio
- All tests → same baseline dB (±2 dB variance)
- Muted → still baseline dB (system mute doesn't affect capture)

## Why This Matters

### If Hypothesis A (volume affects capture):
- **Implication:** Owner must keep Windows volume at 100% for partner to hear properly
- **UX:** Show warning in Mode C setup: "Keep your system volume at 100%. Use the in-app mixer to control your own listening level."
- **Mixer design:** Owner's movie volume slider controls their local audio output only, not what is captured

### If Hypothesis B (volume does NOT affect capture):
- **Implication:** Owner can lower Windows volume freely; partner hears full audio
- **UX:** No warning needed; cleaner Mode C experience
- **Mixer design:** Simpler; no split between "my volume" and "captured volume"

## Device-Specific Behavior

Windows audio capture behavior may vary by:
- **Audio driver:** Realtek vs others
- **Windows version:** Windows 10 vs 11
- **Chrome/Edge version:** Different implementations of getDisplayMedia audio capture

We should test on:
- Windows 10 + Chrome 120+
- Windows 11 + Edge 120+
- Windows 10 + Firefox (if Firefox supports `getDisplayMedia` audio by then)

## Format Doctor Guidance

Based on test results, update Format Doctor Mode C tips:

**If volume affects capture:**
```
⚠️ Mode C (Screen Share) Tips:
- Keep Windows system volume at 100%
- Use in-app mixer to control your own listening level
- Enable Focus Assist / Do Not Disturb to avoid notifications
- Share entire screen (not just VLC window) to capture audio
- Remote control is not available in this mode
```

**If volume does NOT affect capture:**
```
✅ Mode C (Screen Share) Tips:
- Share entire screen (not just VLC window) to capture audio
- Enable Focus Assist / Do Not Disturb to avoid notifications
- Remote control is not available in this mode
- You can adjust your own volume freely
```

## Conclusion (Pending)

**Must complete before M4 milestone.** Test results will determine:
1. Mode C setup warning copy
2. Mixer UI design (separate "my volume" vs "captured volume" sliders?)
3. Format Doctor tips wording

**Risk if not tested:** Users in Mode C may stream silent or low-volume audio to partner, causing confusion and support burden.

---

**Test before:** M4 deployment  
**Assigned to:** Engineering team (requires Windows device + macOS device + 2 browsers)  
**Estimated time:** 30 minutes

