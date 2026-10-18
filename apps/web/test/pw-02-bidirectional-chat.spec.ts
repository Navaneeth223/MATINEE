import { test, expect, chromium } from '@playwright/test';

test('PW-02: B joins with invite, both Connected, bidirectional chat', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto('http://localhost:5199');
  await pageA.click('button:has-text("Create Room")');
  await pageA.waitForURL(/\/r\//, { timeout: 5000 });
  
  await pageA.click('[data-testid="copy-invite"]');
  const inviteUrl = await pageA.getAttribute('[data-testid="copy-invite"]', 'data-invite-url');
  expect(inviteUrl).toContain('#k=');
  
  await expect(pageA.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 5000 });
  
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  
  await pageB.goto(inviteUrl!);
  await expect(pageB.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 5000 });
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
