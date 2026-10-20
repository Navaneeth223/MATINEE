import { test, expect } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test('PW-07: viewer seek moves source within 1s', async ({ browser }) => {
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
    await expect(videoA).toBeVisible({ timeout: 5_000 });

    // Wait for video to have duration
    await expect(async () => {
      const duration = await videoA.evaluate((v: HTMLVideoElement) => v.duration);
      expect(duration).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

    // Viewer: seek to 30s
    const seekButton = pageB.getByRole('button', { name: /seek.*30/i });
    const startTime = Date.now();
    await seekButton.click();

    // Source video should move to ~30s within 1s
    await expect(async () => {
      const currentTime = await videoA.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(Math.abs(currentTime - 30)).toBeLessThan(1.0);
    }).toPass({ timeout: 1_500 });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(1000);
  } finally {
    await pageA.close();
    await pageB.close();
    await ctxA.close();
    await ctxB.close();
  }
});
