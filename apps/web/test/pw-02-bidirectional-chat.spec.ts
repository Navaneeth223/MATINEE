import { test, expect, chromium } from '@playwright/test';

test('PW-02: B joins with invite, both Connected, bidirectional chat', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto('http://localhost:5173');
  await pageA.click('button:has-text("Create Room")');
  await pageA.waitForURL(/\/r\//, { timeout: 5000 });
  
  await pageA.click('button:has-text("Copy")');
  const inviteUrl = await pageA.getAttribute('button[data-invite-url]', 'data-invite-url');
  expect(inviteUrl).toContain('#k=');
  
  await expect(pageA.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
  
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  
  await pageB.goto(inviteUrl!);
  await expect(pageB.locator('text=/Connected/i')).toBeVisible({ timeout: 5000 });
  await expect(pageA.locator('text=/Connected/i')).toBeVisible({ timeout: 1000 });
  
  await pageA.waitForTimeout(500);
  
  await pageA.fill('input[placeholder*="message"]', 'Hello from A');
  await pageA.press('input[placeholder*="message"]', 'Enter');
  await pageB.waitForTimeout(1500);
  
  await expect(pageB.locator('text=/Peer: Hello from A/i')).toBeVisible();
  
  await pageB.fill('input[placeholder*="message"]', 'Hello from B');
  await pageB.press('input[placeholder*="message"]', 'Enter');
  await pageA.waitForTimeout(1500);
  
  await expect(pageA.locator('text=/Peer: Hello from B/i')).toBeVisible();

  await contextB.close();
  await contextA.close();
  await browser.close();
});
