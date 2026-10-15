import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('M2 Two-Browser E2EE Test', () => {
  test('A creates room, B joins, chat works, C gets full, wrong secret refused', async () => {
    const browser = await chromium.launch({ headless: true });
    
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    try {
      // A creates room
      await pageA.goto(BASE_URL);
      
      // Capture room URL with fragment before navigation
      let fullRoomUrl = '';
      await pageA.evaluate(() => {
        (window as any).capturedUrl = null;
        const origPush = history.pushState;
        history.pushState = function(...args) {
          if (args[2] && typeof args[2] === 'string' && args[2].includes('/r/')) {
            (window as any).capturedUrl = window.location.href + window.location.hash;
          }
          return origPush.apply(history, args);
        };
      });
      
      await pageA.click('button:has-text("Create Room")');
      await pageA.waitForURL(/\/r\//, { timeout: 5000 });
      
      // Get captured URL before fragment was stripped
      fullRoomUrl = await pageA.evaluate(() => (window as any).capturedUrl || '');
      
      // Verify fragment is gone from address bar
      const urlA = pageA.url();
      expect(urlA).not.toContain('#k=');
      
      await pageA.screenshot({ path: 'docs/evidence/m2/1-a-connected.png' });
      
      // Extract roomId and secret
      if (!fullRoomUrl || !fullRoomUrl.includes('#k=')) {
        // Fallback: manually construct URL with a test secret
        // This is a limitation - in real usage, A shares the full URL
        console.log('Warning: Could not capture fragment URL, test incomplete');
        throw new Error('Could not capture room URL with secret');
      }
      
      const roomId = fullRoomUrl.match(/\/r\/([^?#]+)/)?.[1];
      const secretMatch = fullRoomUrl.match(/#k=([A-Za-z0-9_-]+)/);
      const secret = secretMatch?.[1];
      
      expect(roomId).toBeTruthy();
      expect(secret).toBeTruthy();
      
      // A should see "Connected"
      await expect(pageA.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
      
      // B tries with wrong secret first
      const wrongSecret = 'AAAAAAAAAAAAAAAAAAAAAA';
      await pageB.goto(`${BASE_URL}/r/${roomId}#k=${wrongSecret}`);
      await expect(pageB.locator('text=/Error.*Wrong secret|Join denied/i')).toBeVisible({ timeout: 5000 });
      await pageB.screenshot({ path: 'docs/evidence/m2/2-b-wrong-secret.png' });
      
      // B joins with correct URL
      await pageB.goto(fullRoomUrl);
      await expect(pageB.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
      await pageB.screenshot({ path: 'docs/evidence/m2/3-b-connected.png' });
      
      // A sends message
      await pageA.fill('input[placeholder*="message"]', 'Hello from A');
      await pageA.press('input[placeholder*="message"]', 'Enter');
      await expect(pageB.locator('text=/Peer: Hello from A/i')).toBeVisible({ timeout: 5000 });
      await pageB.screenshot({ path: 'docs/evidence/m2/4-b-received-message.png' });
      
      // B sends message
      await pageB.fill('input[placeholder*="message"]', 'Hello from B');
      await pageB.press('input[placeholder*="message"]', 'Enter');
      await expect(pageA.locator('text=/Peer: Hello from B/i')).toBeVisible({ timeout: 5000 });
      await pageA.screenshot({ path: 'docs/evidence/m2/5-a-received-message.png' });
      
      // C tries to join (room full)
      await pageC.goto(fullRoomUrl);
      await expect(pageC.locator('text=/Room full|full/i')).toBeVisible({ timeout: 5000 });
      await pageC.screenshot({ path: 'docs/evidence/m2/6-c-room-full.png' });
      
      console.log('✓ All assertions passed');
      
    } finally {
      await contextA.close();
      await contextB.close();
      await contextC.close();
      await browser.close();
    }
  });
});
