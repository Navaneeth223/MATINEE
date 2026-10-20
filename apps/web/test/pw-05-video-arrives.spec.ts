import { test, expect } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test('PW-05: viewer receives video stream within 5s', async ({ browser }) => {
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

    // Wait for Connected state on both
    await expect(pageA.getByText('Connected')).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText('Connected')).toBeVisible({ timeout: 10_000 });

    // Source: pick fake video file
    const fileInput = pageA.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake video content'),
    });

    // Viewer: wait for video element with stream
    const videoB = pageB.locator('video');
    await expect(videoB).toBeVisible({ timeout: 5_000 });

    // Poll for videoWidth > 0 (stream attached and dimensions known)
    await expect(async () => {
      const width = await videoB.evaluate((v: HTMLVideoElement) => v.videoWidth);
      expect(width).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

    // Poll for framesDecoded rising (video decoding)
    const stats1 = await videoB.evaluate((v: HTMLVideoElement) => {
      const video = v as any;
      return video.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0;
    });

    await pageB.waitForTimeout(500);

    const stats2 = await videoB.evaluate((v: HTMLVideoElement) => {
      const video = v as any;
      return video.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0;
    });

    expect(stats2).toBeGreaterThan(stats1);
  } finally {
    await pageA.close();
    await pageB.close();
    await ctxA.close();
    await ctxB.close();
  }
});
