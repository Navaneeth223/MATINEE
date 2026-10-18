import { test, expect, chromium } from '@playwright/test';

test('PW-03: C gets "room full" when A and B are connected', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto('http://localhost:5199');
  await pageA.click('button:has-text("Create Room")');
  await pageA.waitForURL(/\/r\//, { timeout: 5000 });
  
  await pageA.click('[data-testid="copy-invite"]');
  const inviteUrl = await pageA.getAttribute('[data-testid="copy-invite"]', 'data-invite-url');
  
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(inviteUrl!);
  await expect(pageB.locator('[data-testid="status-text"]:has-text("Connected")')).toBeVisible({ timeout: 5000 });
  
  const contextC = await browser.newContext();
  const pageC = await contextC.newPage();
  await pageC.goto(inviteUrl!);
  await expect(pageC.locator('[data-testid="status-text"]:has-text("full")')).toBeVisible({ timeout: 5000 });

  await contextC.close();
  await contextB.close();
  await contextA.close();
  await browser.close();
});
