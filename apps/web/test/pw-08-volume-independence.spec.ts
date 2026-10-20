import { test, expect } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test('PW-08: source local gain does not affect viewer volume', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    await pageA.goto('http://localhost:5199');
    await pageA.getByRole('button', { name: /create/i }).click();
    const inviteUrlAttr = await pageA.locator('[data-invite-url]').getAttribute('data-invite-url');
    const inviteUrl = inviteUrlAttr!;

    await pageB.goto(inviteUrl);
    await pageB.getByRole('button', { name: /join/i }).click();

    await expect(pageA.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText('Connected')).toBeVisible({ timeout: 10_000 });

    // Source: pick file
    const fileInput = pageA.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video'),
    });

    const videoA = pageA.locator('video');
    const videoB = pageB.locator('video');
    await expect(videoA).toBeVisible({ timeout: 5_000 });
    await expect(videoB).toBeVisible({ timeout: 5_000 });

    // Viewer: click "Start watching" if needed
    const startBtn = pageB.getByRole('button', { name: /start watching/i });
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // Measure baseline viewer volume
    await pageB.waitForTimeout(500);
    const baselineB = await videoB.evaluate((v: HTMLVideoElement) => v.volume);
    expect(baselineB).toBeGreaterThan(0);

    // Source: mute local audio (sets local gain to 0)
    const muteBtn = pageA.getByRole('button', { name: /mute/i });
    await muteBtn.click();

    // Wait for mute to take effect
    await pageA.waitForTimeout(500);

    // Verify source video is muted
    const mutedA = await videoA.evaluate((v: HTMLVideoElement) => v.muted);
    expect(mutedA).toBe(true);

    // Measure viewer volume again - should be unchanged
    await pageB.waitForTimeout(500);
    const afterB = await videoB.evaluate((v: HTMLVideoElement) => v.volume);

    // Volume should remain within 80-120% of baseline
    const ratio = afterB / baselineB;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.2);
  } finally {
    await pageA.close();
    await pageB.close();
    await ctxA.close();
    await ctxB.close();
  }
});
