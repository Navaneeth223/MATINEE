import { test, expect, chromium } from '@playwright/test';

test('PW-04: D with wrong secret is refused', async () => {
  const browser = await chromium.launch({ headless: true });
  
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto('http://localhost:5199');
  await pageA.click('button:has-text("Create Room")');
  await pageA.waitForURL(/\/r\//, { timeout: 5000 });
  
  const roomUrl = pageA.url();
  const roomId = roomUrl.match(/\/r\/([^?#]+)/)?.[1];
  
  const contextD = await browser.newContext();
  const pageD = await contextD.newPage();
  
  await pageD.goto(`http://localhost:5199/r/${roomId}#k=AAAAAAAAAAAAAAAAAAAAAA`);
  await expect(pageD.locator('[data-testid="status-text"]:has-text("denied")')).toBeVisible({ timeout: 5000 });

  await contextD.close();
  await contextA.close();
  await browser.close();
});
