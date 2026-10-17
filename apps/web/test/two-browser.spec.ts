import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('M2 Two-Browser E2EE Test', () => {
  test('bidirectional chat, fragment stripped, third context full, wrong secret refused', async () => {
    const browser = await chromium.launch({ headless: true });
    
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const logsA: string[] = [];
    
    pageA.on('console', msg => logsA.push(`[A console] ${msg.type()}: ${msg.text()}`));
    pageA.on('websocket', ws => {
      logsA.push('[A ws] created');
      ws.on('framesent', f => logsA.push(`[A →] ${f.payload?.toString().substring(0,150)}`));
      ws.on('framereceived', f => logsA.push(`[A ←] ${f.payload?.toString().substring(0,150)}`));
    });

    try {
      // A creates room
      await pageA.goto(BASE_URL);
      await pageA.click('button:has-text("Create Room")');
      await pageA.waitForURL(/\/r\//, { timeout: 5000 });
      
      const urlA = pageA.url();
      expect(urlA).not.toContain('#k=');
      
      await pageA.click('button:has-text("Copy")');
      const fullRoomUrl = await pageA.getAttribute('button[data-invite-url]', 'data-invite-url');
      expect(fullRoomUrl).toContain('#k=');
      
      await pageA.screenshot({ path: 'docs/evidence/m2/1-a-connected.png' });
      
      // B with correct URL (new context)
      const contextB = await browser.newContext();
      const pageB = await contextB.newPage();
      const logsB: string[] = [];
      
      pageB.on('console', msg => logsB.push(`[B console] ${msg.type()}: ${msg.text()}`));
      pageB.on('websocket', ws => {
        logsB.push('[B ws] created');
        ws.on('framesent', f => logsB.push(`[B →] ${f.payload?.toString().substring(0,150)}`));
        ws.on('framereceived', f => logsB.push(`[B ←] ${f.payload?.toString().substring(0,150)}`));
      });
      
      await pageB.goto(fullRoomUrl!);
      await expect(pageB.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
      await pageB.screenshot({ path: 'docs/evidence/m2/2-b-connected.png' });
      
      await pageA.waitForTimeout(1000);
      await pageB.waitForTimeout(1000);
      
      // A sends
      await pageA.fill('input[placeholder*="message"]', 'Hello from A');
      await pageA.press('input[placeholder*="message"]', 'Enter');
      await pageB.waitForTimeout(2000);
      
      const bHasMsg = await pageB.locator('text=/Peer: Hello from A/i').isVisible();
      if (!bHasMsg) {
        console.log('=== A LOGS ==='); logsA.slice(-15).forEach(l => console.log(l));
        console.log('=== B LOGS ==='); logsB.slice(-15).forEach(l => console.log(l));
      }
      expect(bHasMsg).toBe(true);
      await pageB.screenshot({ path: 'docs/evidence/m2/3-b-received.png' });
      
      // B sends
      await pageB.fill('input[placeholder*="message"]', 'Hello from B');
      await pageB.press('input[placeholder*="message"]', 'Enter');
      await pageA.waitForTimeout(2000);
      
      const aHasMsg = await pageA.locator('text=/Peer: Hello from B/i').isVisible();
      expect(aHasMsg).toBe(true);
      await pageA.screenshot({ path: 'docs/evidence/m2/4-a-received.png' });
      
      await contextB.close();
      
      // C third visitor (new context)
      const contextC = await browser.newContext();
      const pageC = await contextC.newPage();
      
      await pageC.goto(fullRoomUrl!);
      await expect(pageC.locator('text=/Room full|full/i')).toBeVisible({ timeout: 5000 });
      await pageC.screenshot({ path: 'docs/evidence/m2/5-c-full.png' });
      await contextC.close();
      
      // D wrong secret (new context)
      const roomId = urlA.match(/\/r\/([^?#]+)/)?.[1];
      const contextD = await browser.newContext();
      const pageD = await contextD.newPage();
      
      await pageD.goto(`${BASE_URL}/r/${roomId}#k=AAAAAAAAAAAAAAAAAAAAAA`);
      await expect(pageD.locator('text=/Error.*Wrong secret|Join denied/i')).toBeVisible({ timeout: 5000 });
      await pageD.screenshot({ path: 'docs/evidence/m2/6-d-wrong.png' });
      await contextD.close();
      
      console.log('✓ ALL TESTS PASSED');
      
    } finally {
      await contextA.close();
      await browser.close();
    }
  });
});
