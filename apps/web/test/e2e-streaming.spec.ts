import { test, expect } from '@playwright/test';

test.describe('Streaming E2E', () => {
  test('A streams to B -> B receives video, controls work', async ({ browser }) => {
    const contextA = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });
    const contextB = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // A creates room
      await pageA.goto('http://localhost:5199/');
      await pageA.click('button:has-text("Create our room")');
      await pageA.waitForURL(/\/r\/.+/);

      // Extract invite URL from copy button
      const inviteLocator = pageA.locator('button:has-text("Copy invite")');
      const inviteUrl = await inviteLocator.getAttribute('data-invite-url');
      if (!inviteUrl) throw new Error('No invite URL found');

      console.log('Invite URL:', inviteUrl);

      // B joins
      await pageB.goto(inviteUrl);
      await expect(pageB.getByTestId('status-text')).toContainText('Connected', { timeout: 10000 });

      // A should see SourcePanel - inject and send test stream via WebRTC
      await pageA.waitForTimeout(2000);

      await pageA.evaluate(() => {
        // Create test stream (canvas + oscillator)
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d')!;

        let frame = 0;
        setInterval(() => {
          ctx.fillStyle = `hsl(${frame % 360}, 100%, 50%)`;
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = 'white';
          ctx.font = '48px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`F${frame}`, 320, 240);
          frame++;
        }, 100);

        const videoStream = canvas.captureStream(10);
        
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        oscillator.frequency.value = 440;
        const dest = audioCtx.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start();

        const combined = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ]);

        // Access the RoomPage's handleStreamReady via global
        const event = new CustomEvent('__test_start_stream', { detail: { stream: combined } });
        window.dispatchEvent(event);
      });

      await pageA.waitForTimeout(1000);
      
      // B should see "Start watching" button
      await expect(pageB.locator('button:has-text("Start watching")')).toBeVisible({ timeout: 10000 });
      
      // B clicks "Start watching"
      await pageB.click('button:has-text("Start watching")');

      // Wait for viewer video element
      const viewerVideo = pageB.locator('[data-testid="viewer-video"]');
      await expect(viewerVideo).toBeVisible({ timeout: 5000 });

      // Wait and verify video is actually playing
      await pageB.waitForTimeout(3000);
      
      const videoStats = await pageB.evaluate(() => {
        const video = document.querySelector('[data-testid="viewer-video"]') as HTMLVideoElement;
        return {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
        };
      });

      console.log('B video stats:', videoStats);
      
      expect(videoStats.videoWidth).toBeGreaterThan(0);
      expect(videoStats.videoHeight).toBeGreaterThan(0);
      expect(videoStats.readyState).toBeGreaterThanOrEqual(2); // HAVE_CURRENT_DATA
      expect(videoStats.paused).toBe(false);

      // Test viewer controls - pause
      await pageB.click('button:has-text("Pause")');
      await pageB.waitForTimeout(1000);
      
      const isPaused = await pageA.evaluate(() => {
        const video = document.querySelector('video[controls]') as HTMLVideoElement;
        return video.paused;
      });
      
      expect(isPaused).toBe(true);

      console.log('✓ Streaming E2E passed: video received, controls work');

    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
