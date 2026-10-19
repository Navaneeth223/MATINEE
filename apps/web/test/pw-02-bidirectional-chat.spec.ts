import { test, expect, chromium } from '@playwright/test';
import { createRoom, joinRoom } from './helpers';

test('PW-02: B joins with invite, both Connected, bidirectional chat', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const { pageA, inviteUrl, contextA } = await createRoom(browser);
  await expect(pageA.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 5000 });
  
  const { page: pageB, context: contextB } = await joinRoom(browser, inviteUrl);
  await expect(pageA.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 1000 });
  
  await pageA.waitForTimeout(500);
  
  await pageA.fill('[data-testid="chat-input"]', 'Hello from A');
  await pageA.press('[data-testid="chat-input"]', 'Enter');
  await pageB.waitForTimeout(1500);
  
  await expect(pageB.locator('[data-testid="chat-message"]:has-text("Peer: Hello from A")')).toBeVisible();
  
  await pageB.fill('[data-testid="chat-input"]', 'Hello from B');
  await pageB.press('[data-testid="chat-input"]', 'Enter');
  await pageA.waitForTimeout(1500);
  
  await expect(pageA.locator('[data-testid="chat-message"]:has-text("Peer: Hello from B")')).toBeVisible();

  await contextB.close();
  await contextA.close();
  await browser.close();
});
