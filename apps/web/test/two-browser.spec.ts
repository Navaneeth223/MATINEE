import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('M2 Two-Browser E2EE Test', () => {
  test('bidirectional chat, fragment stripped, third context full, wrong secret refused', async () => {
    const browser = await chromium.launch({ headless: true });
    
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    // Console and WebSocket logging for both pages
    const logsA: string[] = [];
    const logsB: string[] = [];
    
    pageA.on('console', msg => {
      logsA.push(`[A console] ${msg.type()}: ${msg.text()}`);
    });
    
    pageB.on('console', msg => {
      logsB.push(`[B console] ${msg.type()}: ${msg.text()}`);
    });
    
    pageA.on('websocket', ws => {
      logsA.push('[A websocket] created');
      ws.on('framesent', frame => logsA.push(`[A →] ${frame.payload?.toString().substring(0, 200)}`));
      ws.on('framereceived', frame => logsA.push(`[A ←] ${frame.payload?.toString().substring(0, 200)}`));
      ws.on('close', () => logsA.push('[A websocket] closed'));
    });
    
    pageB.on('websocket', ws => {
      logsB.push('[B websocket] created');
      ws.on('framesent', frame => logsB.push(`[B →] ${frame.payload?.toString().substring(0, 200)}`));
      ws.on('framereceived', frame => logsB.push(`[B ←] ${frame.payload?.toString().substring(0, 200)}`));
      ws.on('close', () => logsB.push('[B websocket] closed'));
    });

    try {
      // A creates room
      await pageA.goto(BASE_URL);
      await pageA.click('button:has-text("Create Room")');
      await pageA.waitForURL(/\/r\//, { timeout: 5000 });
      
      // Verify fragment is stripped from address bar
      const urlA = pageA.url();
      expect(urlA).not.toContain('#k=');
      logsA.push(`[A] Final URL: ${urlA}`);
      
      await pageA.screenshot({ path: 'docs/evidence/m2/1-a-connected.png' });
      
      // Wait for "Copy invite link" button to appear
      await pageA.waitForSelector('button:has-text("Copy")', { timeout: 5000 });
      
      // Click copy button to get invite URL
      await pageA.click('button:has-text("Copy")');
      
      // Read from data attribute instead of clipboard
      const fullRoomUrl = await pageA.getAttribute('button[data-invite-url]', 'data-invite-url');
      logsA.push(`[A] Copied invite URL: ${fullRoomUrl}`);
      
      expect(fullRoomUrl).toContain('#k=');
      const secretMatch = fullRoomUrl.match(/#k=([A-Za-z0-9_-]+)/);
      expect(secretMatch).toBeTruthy();
      
      const roomId = urlA.match(/\/r\/([^?#]+)/)?.[1];
      const wrongSecret = 'AAAAAAAAAAAAAAAAAAAAAA';
      
      // B tries with wrong secret first
      await pageB.goto(`${BASE_URL}/r/${roomId}#k=${wrongSecret}`);
      await expect(pageB.locator('text=/Error.*Wrong secret|Join denied/i')).toBeVisible({ timeout: 5000 });
      await pageB.screenshot({ path: 'docs/evidence/m2/2-b-wrong-secret.png' });
      logsB.push('[B] Wrong secret - join denied as expected');
      
      // B joins with correct URL from clipboard
      await pageB.goto(fullRoomUrl);
      await expect(pageB.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
      await pageB.screenshot({ path: 'docs/evidence/m2/3-b-connected.png' });
      logsB.push('[B] Connected with correct secret');
      
      // Wait a bit for WebSocket messages to settle
      await pageA.waitForTimeout(1000);
      await pageB.waitForTimeout(1000);
      
      // A sends message to B
      await pageA.fill('input[placeholder*="message"]', 'Hello from A');
      await pageA.press('input[placeholder*="message"]', 'Enter');
      logsA.push('[A] Sent message: Hello from A');
      
      // Wait and check if B received
      await pageB.waitForTimeout(2000);
      
      // Check B's page for message
      const bHasMessage = await pageB.locator('text=/Peer: Hello from A/i').isVisible();
      logsB.push(`[B] Message visible: ${bHasMessage}`);
      
      if (!bHasMessage) {
        console.log('\n=== PAGE A LOGS ===');
        logsA.forEach(log => console.log(log));
        console.log('\n=== PAGE B LOGS ===');
        logsB.forEach(log => console.log(log));
      }
      
      expect(bHasMessage).toBe(true);
      await pageB.screenshot({ path: 'docs/evidence/m2/4-b-received-message.png' });
      
      // B sends message to A
      await pageB.fill('input[placeholder*="message"]', 'Hello from B');
      await pageB.press('input[placeholder*="message"]', 'Enter');
      logsB.push('[B] Sent message: Hello from B');
      
      await pageA.waitForTimeout(2000);
      
      const aHasMessage = await pageA.locator('text=/Peer: Hello from B/i').isVisible();
      logsA.push(`[A] Message visible: ${aHasMessage}`);
      
      if (!aHasMessage) {
        console.log('\n=== PAGE A LOGS (after B sent) ===');
        logsA.forEach(log => console.log(log));
        console.log('\n=== PAGE B LOGS (after B sent) ===');
        logsB.forEach(log => console.log(log));
      }
      
      expect(aHasMessage).toBe(true);
      await pageA.screenshot({ path: 'docs/evidence/m2/5-a-received-message.png' });
      
      // C tries to join (room full)
      await pageC.goto(fullRoomUrl);
      await expect(pageC.locator('text=/Room full|full/i')).toBeVisible({ timeout: 5000 });
      await pageC.screenshot({ path: 'docs/evidence/m2/6-c-room-full.png' });
      
      console.log('\n=== ALL TESTS PASSED ===');
      
    } catch (error) {
      console.log('\n=== TEST FAILED ===');
      console.log('\n=== PAGE A LOGS ===');
      logsA.forEach(log => console.log(log));
      console.log('\n=== PAGE B LOGS ===');
      logsB.forEach(log => console.log(log));
      throw error;
      
    } finally {
      await contextA.close();
      await contextB.close();
      await contextC.close();
      await browser.close();
    }
  });
});
