import { test, expect } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test('PW-06: viewer pause pauses source within 800ms', async ({ browser }) => {
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

    // Source: pick file and wait for playback to start
    const fileInput = pageA.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video'),
    });

    const videoA = pageA.locator('video');
    await expect(videoA).toBeVisible({ timeout: 5_000 });

    // Wait for source video to be playing
    await expect(async () => {
      const paused = await videoA.evaluate((v: HTMLVideoElement) => v.paused);
      expect(paused).toBe(false);
    }).toPass({ timeout: 5_000 });

    // Viewer: click pause button
    const startTime = Date.now();
    await pageB.getByRole('button', { name: /pause/i }).click();

    // Source video should pause within 800ms
    await expect(async () => {
      const paused = await videoA.evaluate((v: HTMLVideoElement) => v.paused);
      expect(paused).toBe(true);
    }).toPass({ timeout: 1_000 });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(800);
  } finally {
    await pageA.close();
    await pageB.close();
    await ctxA.close();
    await ctxB.close();
  }
});
