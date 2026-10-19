import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

test('SLICE 1 spike: WebRTC loopback with volume independence', async ({ page }) => {
  const htmlPath = path.join(process.cwd(), 'test', 'webrtc-loopback-spike.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  
  await page.setContent(htmlContent);
  
  // Wait for measurements
  await page.waitForFunction(() => window.spikeResults, { timeout: 10000 });
  
  const results = await page.evaluate(() => window.spikeResults);
  
  console.log('Spike results:', JSON.stringify(results, null, 2));
  
  if (results.error) {
    throw new Error(`Spike failed: ${results.error}`);
  }
  
  // Assertions
  expect(results.videoWidth).toBeGreaterThan(0);
  expect(results.videoHeight).toBeGreaterThan(0);
  expect(results.currentTimeAdvancing).toBe(true);
  expect(results.framesDecoded).toBeGreaterThan(0);
  expect(results.audioLevelBAfterHostMute).toBeGreaterThan(0); // Audio arrives even when host muted
  expect(results.volumeIndependent).toBe(true);
  
  // Save to docs/spikes/S5.md
  const report = `# S5: WebRTC Feasibility Spike

## Setup
- Loopback: pcA sends generated clip (canvas + oscillator) to pcB in same page
- Video: 320x240 canvas, red square moving
- Audio: 440 Hz sine wave via MediaStreamDestination
- Host volume: MediaElementSource -> local gain -> speakers (separate from sent stream)

## Results
- B videoWidth: ${results.videoWidth}
- B videoHeight: ${results.videoHeight}
- B currentTime advancing: ${results.currentTimeAdvancing}
- B framesDecoded: ${results.framesDecoded}
- B audioLevel (initial): ${results.audioLevelB.toFixed(2)}
- B audioLevel (host muted): ${results.audioLevelBAfterHostMute.toFixed(2)}
- Volume independence: ${results.volumeIndependent ? 'PASS' : 'FAIL'}

## Conclusion
✓ Video arrives (width/height > 0, frames decoded)
✓ Playback advancing (currentTime increases)
✓ Audio arrives (level > 0)
✓ Volume independence confirmed (host gain=0 does NOT affect received audio)

**Feasibility: CONFIRMED**
`;
  
  const spikesDir = path.join(process.cwd(), '..', '..', 'docs', 'spikes');
  fs.mkdirSync(spikesDir, { recursive: true });
  fs.writeFileSync(path.join(spikesDir, 'S5.md'), report);
});
